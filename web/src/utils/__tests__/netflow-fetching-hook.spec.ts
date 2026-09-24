import { act, renderHook } from '@testing-library/react';
import * as React from 'react';
import { defaultNetflowMetrics, NetflowMetrics, Stats } from '../../api/query-response';
import { FlowsSample } from '../../components/__tests-data__/flows';
import { defaultConfig } from '../../model/config';
import { FetchCallbacks, useNetflowContext } from '../../model/netflow-context';
import { DefaultOptions } from '../../model/topology';
import {
  canTick,
  handleQueryError,
  handleQueryResult,
  InitState,
  useDataFetching,
  UseDataFetchingParams
} from '../netflow-fetching-hook';
import { Result } from '../result';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useDataFetching overlapping requests', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = (overrides: Partial<UseDataFetchingParams> = {}) => {
    const requests: Array<ReturnType<typeof deferred<Stats[]>> & { callbacks: FetchCallbacks }> = [];
    const udnRequests: Array<ReturnType<typeof deferred<string[]>>> = [];
    let getCallbacks: () => FetchCallbacks;
    const fetch = () => {
      const request = { ...deferred<Stats[]>(), callbacks: getCallbacks() };
      requests.push(request);
      return request.promise;
    };
    const params: Omit<UseDataFetchingParams, 'caps'> = {
      drawerRef: {
        current: {
          getOverviewHandle: () => ({ fetch }),
          getTableHandle: () => ({ fetch }),
          getTopologyHandle: () => ({
            fetch,
            fetchUDNs: () => {
              const request = deferred<string[]>();
              udnRequests.push(request);
              return request.promise;
            }
          })
        }
      },
      initState: { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] },
      config: defaultConfig,
      selectedViewId: 'overview',
      activeView: 'all',
      range: 300,
      histogramRange: undefined,
      showHistogram: false,
      showDuplicates: false,
      metricScope: 'namespace',
      topologyMetricType: 'Bytes',
      topologyMetricFunction: 'avg',
      topologyOptions: DefaultOptions,
      interval: undefined,
      isTRModalOpen: false,
      isOverviewModalOpen: false,
      isColModalOpen: false,
      isExportModalOpen: false,
      filters: { match: 'all', list: [] },
      setFilters: jest.fn(),
      setConfig: jest.fn(),
      queryParams: '',
      ...overrides
    };
    const hook = renderHook(
      props => {
        const { caps } = useNetflowContext();
        const result = useDataFetching({ ...props, caps: { ...caps, allowLoki: true } });
        getCallbacks = result.getFetchCallbacks;
        return result;
      },
      { initialProps: params }
    );
    return { ...hook, params, requests, udnRequests };
  };

  const latestStats: Stats = { numQueries: 2, limitReached: false, dataSources: ['loki'] };
  const latestMetrics: NetflowMetrics = { ...defaultNetflowMetrics, rate: Result.success({ bytes: [] }) };

  it.each(['success', 'error'])('ignores an older %s after switching views', async completion => {
    const { result, rerender, params, requests } = setup();
    rerender({ ...params, activeView: 'udn' });
    expect(requests).toHaveLength(2);

    await act(async () => {
      requests[1].callbacks.setMetrics(latestMetrics);
      requests[1].callbacks.setFlows(FlowsSample);
      requests[1].resolve([latestStats]);
    });
    const lastRefresh = result.current.lastRefresh;
    const lastDuration = result.current.lastDuration;
    const staleUpdater = jest.fn(() => defaultNetflowMetrics);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      requests[0].callbacks.setMetrics(defaultNetflowMetrics);
      requests[0].callbacks.setMetrics(staleUpdater);
      requests[0].callbacks.setFlows([]);
      requests[0].callbacks.setError('stale tab error');
      if (completion === 'success') {
        requests[0].resolve([{ ...latestStats, numQueries: 99 }]);
      } else {
        requests[0].reject('stale request error');
      }
    });

    expect(result.current.metrics).toBe(latestMetrics);
    expect(result.current.flows).toBe(FlowsSample);
    expect(result.current.stats).toEqual(latestStats);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.lastRefresh).toBe(lastRefresh);
    expect(result.current.lastDuration).toBe(lastDuration);
    expect(staleUpdater).not.toHaveBeenCalled();
  });

  it('keeps loading until the latest manual refresh finishes', async () => {
    const { result, requests } = setup();
    act(() => result.current.tick());
    await act(async () => requests[0].resolve([latestStats]));

    expect(result.current.loading).toBe(true);
    expect(result.current.stats).toBeUndefined();
    expect(result.current.lastRefresh).toBeUndefined();
    expect(result.current.lastDuration).toBeUndefined();

    await act(async () => requests[1].resolve([latestStats]));
    expect(result.current.loading).toBe(false);
    expect(result.current.stats).toEqual(latestStats);
    expect(result.current.lastRefresh).toBeDefined();
  });

  it.each(['success', 'error'])('waits for a slow query to finish with %s before polling again', async completion => {
    const { result, requests } = setup({ interval: 1000 });
    await act(async () => jest.advanceTimersByTime(4000));
    expect(requests).toHaveLength(1);
    expect(result.current.warning?.type).toBe('slow');

    await act(async () => {
      if (completion === 'success') {
        requests[0].callbacks.setMetrics(latestMetrics);
        requests[0].callbacks.setFlows(FlowsSample);
        requests[0].resolve([latestStats]);
      } else {
        requests[0].reject('query failed');
      }
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.lastRefresh).toBeDefined();
    if (completion === 'success') {
      expect(result.current.metrics).toBe(latestMetrics);
      expect(result.current.flows).toBe(FlowsSample);
      expect(result.current.stats).toEqual(latestStats);
    } else {
      expect(result.current.error).toBe('query failed');
    }

    act(() => jest.advanceTimersByTime(1000));
    expect(requests).toHaveLength(2);
    expect(result.current.loading).toBe(true);
    await act(async () => requests[1].resolve([latestStats]));
  });

  it('does not let an older request re-enable polling while a newer view is loading', async () => {
    const { result, params, rerender, requests } = setup({ interval: 1000 });
    rerender({ ...params, activeView: 'udn' });
    expect(requests).toHaveLength(2);
    await act(async () => requests[0].resolve([latestStats]));
    act(() => jest.advanceTimersByTime(1000));
    expect(requests).toHaveLength(2);
    expect(result.current.loading).toBe(true);

    await act(async () => requests[1].resolve([latestStats]));
    act(() => jest.advanceTimersByTime(1000));
    expect(requests).toHaveLength(3);
    await act(async () => requests[2].resolve([latestStats]));
  });

  it.each(['isTRModalOpen', 'isOverviewModalOpen', 'isColModalOpen', 'isExportModalOpen'] as const)(
    'accepts the in-flight result while %s is open',
    async modal => {
      const { result, params, rerender, requests } = setup({ interval: 1000 });
      rerender({ ...params, [modal]: true });
      expect(requests).toHaveLength(1);
      await act(async () => {
        requests[0].callbacks.setMetrics(latestMetrics);
        requests[0].resolve([latestStats]);
      });
      expect(result.current.metrics).toBe(latestMetrics);
      expect(result.current.stats).toEqual(latestStats);
      expect(result.current.loading).toBe(false);
      expect(result.current.lastRefresh).toBeDefined();

      act(() => jest.advanceTimersByTime(1000));
      expect(requests).toHaveLength(1);
      rerender(params);
      expect(requests).toHaveLength(2);
      await act(async () => requests[1].resolve([latestStats]));
    }
  );

  it('keeps polling available when a tab handle is not ready', async () => {
    const fetch = jest.fn().mockResolvedValue([latestStats]);
    const getOverviewHandle = jest.fn().mockReturnValueOnce(null).mockReturnValue({ fetch });
    const { result } = setup({
      interval: 1000,
      drawerRef: {
        current: { getOverviewHandle, getTableHandle: () => null, getTopologyHandle: () => null }
      }
    });
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.stats).toEqual(latestStats);
  });

  it('cancels a scheduled drawer retry when a modal opens', async () => {
    const { params, rerender } = setup({ drawerRef: { current: null } });
    const fetch = jest.fn().mockResolvedValue([latestStats]);
    const readyParams = {
      ...params,
      drawerRef: {
        current: {
          getOverviewHandle: () => ({ fetch }),
          getTableHandle: () => null,
          getTopologyHandle: () => null
        }
      }
    };
    rerender({ ...readyParams, isTRModalOpen: true });
    act(() => jest.runOnlyPendingTimers());
    expect(jest.getTimerCount()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => rerender(readyParams));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows slow-query warnings only for the latest request', async () => {
    const { result, requests } = setup();
    act(() => jest.advanceTimersByTime(3000));
    act(() => result.current.tick());
    await act(async () => jest.advanceTimersByTime(1000));
    expect(result.current.warning).toBeUndefined();

    await act(async () => jest.advanceTimersByTime(3000));
    expect(result.current.warning?.type).toBe('slow');
    await act(async () => requests.forEach(request => request.resolve([latestStats])));
  });

  it('ignores late UDN results after leaving topology', async () => {
    const { result, params, rerender, requests, udnRequests } = setup({
      selectedViewId: 'topology',
      metricScope: 'network',
      topologyOptions: { ...DefaultOptions, showEmpty: true }
    });
    rerender({ ...params, selectedViewId: 'overview' });
    await act(async () => {
      requests[1].resolve([latestStats]);
      udnRequests[0].resolve(['stale-network']);
      requests[0].resolve([latestStats]);
    });
    expect(result.current.topologyUDNIds).toEqual([]);
    expect(result.current.stats).toEqual(latestStats);
  });

  it('invalidates tab callbacks on unmount', async () => {
    const { unmount, requests } = setup();
    unmount();
    const updater = jest.fn(() => latestMetrics);
    await act(async () => {
      requests[0].callbacks.setMetrics(updater);
      requests[0].resolve([latestStats]);
    });
    expect(updater).not.toHaveBeenCalled();
  });
});

describe('canTick', () => {
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  const closedModals = {
    isTRModalOpen: false,
    isOverviewModalOpen: false,
    isColModalOpen: false,
    isExportModalOpen: false
  };

  it('should return true when fully initialized and no modal open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(true);
  });

  it('should return false when config not loaded', () => {
    const initState = { current: ['initDone', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(false);
  });

  it('should return false when forcedFilters not loaded', () => {
    const initState = { current: ['initDone', 'configLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(false);
  });

  it('should return false when config load error', () => {
    const initState = {
      current: ['initDone', 'configLoaded', 'forcedFiltersLoaded', 'configLoadError'] as InitState
    };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(false);
  });

  it('should return false when time range modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isTRModalOpen: true })).toBe(
      false
    );
  });

  it('should return false when overview modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(
      canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isOverviewModalOpen: true })
    ).toBe(false);
  });

  it('should return false when columns modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isColModalOpen: true })).toBe(
      false
    );
  });

  it('should return false when export modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isExportModalOpen: true })).toBe(
      false
    );
  });
});

describe('handleQueryResult', () => {
  it('should merge stats from multiple queries', () => {
    const setStats = jest.fn();
    const stats1: Stats = { numQueries: 1, limitReached: false, dataSources: ['loki'] };
    const stats2: Stats = { numQueries: 2, limitReached: true, dataSources: ['prom'] };

    handleQueryResult([stats1, stats2], setStats);

    expect(setStats).toHaveBeenCalledWith(
      expect.objectContaining({
        numQueries: 3,
        limitReached: true,
        dataSources: expect.arrayContaining(['loki', 'prom'])
      })
    );
  });

  it('should handle single stats entry', () => {
    const setStats = jest.fn();
    const stats: Stats = { numQueries: 1, limitReached: false, dataSources: ['loki'] };

    handleQueryResult([stats], setStats);

    expect(setStats).toHaveBeenCalledWith(stats);
  });

  it('should set undefined stats for empty array', () => {
    const setStats = jest.fn();
    handleQueryResult([], setStats);
    expect(setStats).toHaveBeenCalledWith(undefined);
  });
});

describe('handleQueryError', () => {
  const makeHandlers = () => ({
    setFlows: jest.fn(),
    setMetrics: jest.fn(),
    setError: jest.fn(),
    setWarning: jest.fn(),
    setChipsPopoverMessage: jest.fn(),
    updateTableFilters: jest.fn()
  });

  const emptyFilters = { match: 'all' as const, list: [] };
  const emptyColumns: never[] = [];

  it('should reset state on generic error', () => {
    const handlers = makeHandlers();
    handleQueryError('Some error', emptyFilters, emptyColumns, undefined, handlers);

    expect(handlers.setFlows).toHaveBeenCalledWith([]);
    expect(handlers.setMetrics).toHaveBeenCalledWith(defaultNetflowMetrics);
    expect(handlers.setError).toHaveBeenCalledWith('Some error');
    expect(handlers.setWarning).toHaveBeenCalledWith(undefined);
    expect(handlers.setChipsPopoverMessage).toHaveBeenCalledWith(undefined);
  });

  it('should handle HTTP error with response data', () => {
    const handlers = makeHandlers();
    const err = { response: { data: 'Server Error' }, toString: () => 'Error' };
    handleQueryError(err, emptyFilters, emptyColumns, undefined, handlers);

    expect(handlers.setFlows).toHaveBeenCalledWith([]);
    expect(handlers.setError).toHaveBeenCalled();
  });
});
