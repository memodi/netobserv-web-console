import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AlertsResult, SilencedAlert } from '../../api/alert';
import { FlowMetricsResult, GenericMetricsResult } from '../../api/query-response';
import { getConfig, getFlowGenericMetrics, getFlowMetrics, getFlowRecords, getRole } from '../../api/routes';
import { FullConfigResultSample, SimpleConfigResultSample } from '../__tests-data__/config';
import { extensionsMock } from '../__tests-data__/extensions';
import { FlowsResultSample } from '../__tests-data__/flows';
import NetflowTraffic from '../netflow-traffic';
import NetflowTrafficParent from '../netflow-traffic-parent';

const useResolvedExtensionsMock = useResolvedExtensions as jest.Mock;

jest.mock('../../api/routes', () => ({
  getConfig: jest.fn(() => Promise.resolve(FullConfigResultSample)),
  getRole: jest.fn(() => Promise.resolve('admin')),
  getFlowRecords: jest.fn(() => Promise.resolve(FlowsResultSample)),
  getFlowMetrics: jest.fn(() =>
    Promise.resolve({
      metrics: [],
      stats: { numQueries: 0, limitReached: false, dataSources: ['loki'] }
    } as FlowMetricsResult)
  ),
  getFlowGenericMetrics: jest.fn(() =>
    Promise.resolve({
      metrics: [],
      stats: { numQueries: 0, limitReached: false, dataSources: ['loki'] }
    } as GenericMetricsResult)
  ),
  getAlerts: jest.fn(() => Promise.resolve({ data: { groups: [] }, status: 'success' } as AlertsResult)),
  getSilencedAlerts: jest.fn(() => Promise.resolve([] as SilencedAlert[]))
}));

const getConfigMock = getConfig as jest.Mock;
const getRoleMock = getRole as jest.Mock;
const getFlowsMock = getFlowRecords as jest.Mock;
const getMetricsMock = getFlowMetrics as jest.Mock;
const getGenericMetricsMock = getFlowGenericMetrics as jest.Mock;


describe('<NetflowTraffic />', () => {
  beforeAll(() => {
    useResolvedExtensionsMock.mockReturnValue(extensionsMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render component', async () => {
    const { container } = render(<NetflowTrafficParent />);
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(container.firstChild).toBeTruthy();
  });

  it('should render refresh components', async () => {
    const { container } = render(<NetflowTraffic />);
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(container.querySelector('#refresh-dropdown-container')).toBeTruthy();
    expect(container.querySelector('#refresh-button')).toBeTruthy();
  });

  it('should load default metrics on button click', async () => {
    const { container } = render(<NetflowTrafficParent />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      // "All Traffic" shows only base panels — only Bytes/Packets metrics fetched
      expect(getMetricsMock).toHaveBeenCalledTimes(2);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(0);
    });

    await act(async () => {
      fireEvent.click(container.querySelector('#refresh-button')!);
    });

    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(4);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(0);
    });
  });

  it('should render toolbar components when config loaded', async () => {
    const { container } = render(<NetflowTrafficParent />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalled();
      expect(getRoleMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('#filter-toolbar')).toBeTruthy();
    });
  });

  it('should load basic metrics on button click', async () => {
    getConfigMock.mockReturnValue(Promise.resolve(SimpleConfigResultSample));

    const { container } = render(<NetflowTrafficParent />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(2);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(0);
    });

    await act(async () => {
      fireEvent.click(container.querySelector('#refresh-button')!);
    });

    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(4);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(0);
    });
  });
});
