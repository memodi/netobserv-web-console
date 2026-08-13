import { isModelFeatureFlag, ModelFeatureFlag, useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { Button, ContentVariants, Flex, FlexItem, PageSection, Title } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../api/ipfix';
import { defaultNetflowMetrics } from '../api/query-response';
import { Config, defaultConfig } from '../model/config';
import { DisabledFilters, Filters, getDisabledFiltersRecord } from '../model/filters';
import {
  DataSource,
  FlowScope,
  isTimeMetric,
  MetricType,
  PacketLoss,
  RecordType,
  StatFunction
} from '../model/flow-query';
import { FetchCallbacks, NetflowContext, NetflowContextValue } from '../model/netflow-context';
import { getGroupsForScope } from '../model/scope';
import { DefaultOptions, GraphElementPeer, TopologyOptions } from '../model/topology';
import { defaultGenericPrefs, DraftView, GenericPrefs, getViewPreset, ViewPresetId } from '../model/views';
import { Column, ColumnSizeMap } from '../utils/columns';
import { useConfigValidation } from '../utils/config-validation-hook';
import { ContextSingleton } from '../utils/context';
import { TimeRange } from '../utils/datetime';
import { useFullScreen } from '../utils/fullscreen-hook';
import { useK8sModelsWithColors } from '../utils/k8s-models-hook';
import {
  defaultArraySelectionOptions,
  localStorageActiveViewKey,
  localStorageColsKey,
  localStorageColsSizesKey,
  localStorageDisabledFiltersKey,
  localStorageGenericColumnPrefsKey,
  localStorageGenericPanelPrefsKey,
  localStorageLastLimitKey,
  localStorageLastTopKey,
  localStorageMetricFunctionKey,
  localStorageMetricScopeKey,
  localStorageMetricTypeKey,
  localStorageOverviewFocusKey,
  localStorageOverviewIdsKey,
  localStorageOverviewTruncateKey,
  localStorageQueryParamsKey,
  localStorageRefreshKey,
  localStorageShowHistogramKey,
  localStorageShowOptionsKey,
  localStorageSizeKey,
  localStorageTopologyOptionsKey,
  localStorageViewIdKey,
  useLocalStorage
} from '../utils/local-storage-hook';
import { useConfigCapabilities } from '../utils/netflow-capabilities-hook';
import { InitState, useDataFetching } from '../utils/netflow-fetching-hook';
import { getPanelFeature, OverviewPanel } from '../utils/overview-panels';
import {
  defaultMetricFunction,
  defaultMetricScope,
  defaultMetricType,
  defaultTimeRange,
  getDataSourceFromURL,
  getFiltersFromURL,
  getLimitFromURL,
  getPacketLossFromURL,
  getRangeFromURL,
  getRecordTypeFromURL,
  getShowDupFromURL,
  setURLFilters
} from '../utils/router';
import { useTheme } from '../utils/theme-hook';
import { netflowTrafficPath, useNavigate } from '../utils/url';
import { useURLSync } from '../utils/url-sync-hook';
import NetflowTrafficDrawer, { NetflowTrafficDrawerHandle } from './drawer/netflow-traffic-drawer';
import { rateMetricFunctions, timeMetricFunctions } from './dropdowns/metric-function-dropdown';
import { limitValues, topValues } from './dropdowns/query-options-panel';
import { RefreshDropdown } from './dropdowns/refresh-dropdown';
import TimeRangeDropdown from './dropdowns/time-range-dropdown';
import { TruncateLength } from './dropdowns/truncate-dropdown';
import { ViewSelector } from './dropdowns/view-selector';
import GuidedTourPopover, { GuidedTourHandle } from './guided-tour/guided-tour';
import Modals from './modals/modals';
import './netflow-traffic.css';
import { SearchEvent, SearchHandle } from './search/search';
import FlowCollectorStatusIndicator from './status/flowcollector-status-indicator';
import TabsContainer from './tabs/tabs-container';
import { FiltersToolbar } from './toolbar/filters-toolbar';
import ChipsPopover from './toolbar/filters/chips-popover';
import HistogramToolbar from './toolbar/histogram-toolbar';
import ViewOptionsToolbar from './toolbar/view-options-toolbar';

export type ViewId = 'overview' | 'table' | 'topology';
export type Size = 's' | 'm' | 'l';

export interface NetflowTrafficProps {
  forcedNamespace?: string;
  forcedFilters?: Filters | null;
  isTab?: boolean;
  hideTitle?: boolean;
  parentConfig?: Config;
}

export const NetflowTraffic: React.FC<NetflowTrafficProps> = ({
  forcedNamespace,
  forcedFilters,
  isTab,
  hideTitle,
  parentConfig
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const isDarkTheme = useTheme();
  const [extensions] = useResolvedExtensions<ModelFeatureFlag>(isModelFeatureFlag);
  ContextSingleton.setContext(forcedNamespace);

  // ===== STATE MANAGEMENT =====
  // Config state
  const [config, setConfig] = React.useState<Config>(defaultConfig);
  const k8sModels = useK8sModelsWithColors();

  // Local storage hooks
  const [queryParams, setQueryParams] = useLocalStorage<string>(localStorageQueryParamsKey);
  const [disabledFilters, setDisabledFilters] = useLocalStorage<DisabledFilters>(localStorageDisabledFiltersKey, {});
  const [size, setSize] = useLocalStorage<Size>(localStorageSizeKey, 'm');
  const [selectedViewId, setSelectedViewId] = useLocalStorage<ViewId>(localStorageViewIdKey, 'overview');
  const [lastLimit, setLastLimit] = useLocalStorage<number>(localStorageLastLimitKey, limitValues[0]);
  const [lastTop, setLastTop] = useLocalStorage<number>(localStorageLastTopKey, topValues[0]);
  const [metricScope, setMetricScope] = useLocalStorage<FlowScope>(localStorageMetricScopeKey, defaultMetricScope);
  const [topologyMetricFunction, setTopologyMetricFunction] = useLocalStorage<StatFunction>(
    localStorageMetricFunctionKey,
    defaultMetricFunction
  );
  const [topologyMetricType, setTopologyMetricType] = useLocalStorage<MetricType>(
    localStorageMetricTypeKey,
    defaultMetricType
  );
  const [interval, setInterval] = useLocalStorage<number | undefined>(localStorageRefreshKey);
  const [showViewOptions, setShowViewOptions] = useLocalStorage<boolean>(localStorageShowOptionsKey, false);
  const [showHistogram, setShowHistogram] = useLocalStorage<boolean>(localStorageShowHistogramKey, false);
  const [overviewTruncateLength, setOverviewTruncateLength] = useLocalStorage<TruncateLength>(
    localStorageOverviewTruncateKey,
    TruncateLength.M
  );
  const [overviewFocus, setOverviewFocus] = useLocalStorage<boolean>(localStorageOverviewFocusKey, false);
  const [topologyOptions, setTopologyOptions] = useLocalStorage<TopologyOptions>(
    localStorageTopologyOptionsKey,
    DefaultOptions
  );
  const [panels, setPanels] = useLocalStorage<OverviewPanel[]>(
    localStorageOverviewIdsKey,
    [],
    defaultArraySelectionOptions
  );
  const [columns, setColumns] = useLocalStorage<Column[]>(localStorageColsKey, [], defaultArraySelectionOptions);
  const [_columnSizes, setColumnSizes] = useLocalStorage<ColumnSizeMap>(localStorageColsSizesKey, {});
  const [activeView, setActiveView] = useLocalStorage<ViewPresetId>(localStorageActiveViewKey, 'all');
  const [genericColumnPrefs, setGenericColumnPrefs] = useLocalStorage<GenericPrefs>(
    localStorageGenericColumnPrefsKey,
    defaultGenericPrefs
  );
  const [genericPanelPrefs, setGenericPanelPrefs] = useLocalStorage<GenericPrefs>(
    localStorageGenericPanelPrefsKey,
    defaultGenericPrefs
  );
  // Draft state (not persisted — lost on refresh)
  const [draftView, setDraftView] = React.useState<DraftView | null>(null);

  // Display state
  const [isViewOptionOverflowMenuOpen, setViewOptionOverflowMenuOpen] = React.useState(false);
  const [isFullScreen, setFullScreen] = useFullScreen();
  const [isShowQuerySummary, setShowQuerySummary] = React.useState<boolean>(false);
  const [isTRModalOpen, setTRModalOpen] = React.useState(false);
  const [isOverviewModalOpen, setOverviewModalOpen] = React.useState(false);
  const [isColModalOpen, setColModalOpen] = React.useState(false);
  const [isExportModalOpen, setExportModalOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<Filters>({ list: [], match: 'all' });
  const [packetLoss, setPacketLoss] = React.useState<PacketLoss>(getPacketLossFromURL());
  const [recordType, setRecordType] = React.useState<RecordType>(getRecordTypeFromURL());
  const [dataSource, setDataSource] = React.useState<DataSource>(getDataSourceFromURL());
  const [showDuplicates, setShowDuplicates] = React.useState<boolean>(getShowDupFromURL());
  const [limit, setLimit] = React.useState<number>(
    getLimitFromURL(selectedViewId === 'table' ? limitValues[0] : topValues[0])
  );
  const [range, setRange] = React.useState<number | TimeRange>(getRangeFromURL());
  const [histogramRange, setHistogramRange] = React.useState<TimeRange>();
  const [_selectedRecord, setSelectedRecord] = React.useState<Record | undefined>(undefined);
  const [_selectedElement, setSelectedElement] = React.useState<GraphElementPeer | undefined>(undefined);
  const [_searchEvent, setSearchEvent] = React.useState<SearchEvent | undefined>(undefined);

  // ===== SIDE EFFECTS =====
  // Set FlowCollector model in ContextSingleton when k8sModels change
  React.useEffect(() => {
    const flowCollectorModelKey = Object.keys(k8sModels).find(k => k.includes('FlowCollector'));
    if (flowCollectorModelKey) {
      ContextSingleton.setFlowCollectorK8SModel(k8sModels[flowCollectorModelKey]);
    }
  }, [k8sModels]);

  // ===== CONFIG CAPABILITIES =====
  const caps = useConfigCapabilities({
    config,
    selectedViewId,
    dataSource,
    columns,
    panels,
    activeView,
    metricScope,
    topologyOptions,
    topologyMetricType,
    forcedNamespace,
    forcedFilters,
    filters,
    limit,
    recordType,
    packetLoss,
    range,
    genericColumnPrefs,
    genericPanelPrefs,
    draftView
  });

  // ===== WRAPPED SETTERS FOR COMPLEX LOGIC =====
  const updateMetricScope = React.useCallback(
    (scope: FlowScope) => {
      setMetricScope(scope);
      // Invalidate groups if necessary, when metrics scope changed
      setTopologyOptions(prevOptions => {
        const groups = getGroupsForScope(scope, config.scopes);
        if (!groups.includes(prevOptions.groupTypes)) {
          return { ...prevOptions, groupTypes: 'auto' };
        }
        return prevOptions;
      });
    },
    [setMetricScope, config.scopes, setTopologyOptions]
  );

  const updateTopologyMetricType = React.useCallback(
    (metricType: MetricType) => {
      if (isTimeMetric(metricType)) {
        // fallback on average if current function not available for time queries
        setTopologyMetricFunction(prevFunc => {
          if (!timeMetricFunctions.includes(prevFunc)) {
            return 'avg';
          }
          return prevFunc;
        });
      } else {
        // fallback on average if current function not available for rate queries
        setTopologyMetricFunction(prevFunc => {
          if (!rateMetricFunctions.includes(prevFunc)) {
            return 'avg';
          }
          return prevFunc;
        });
      }
      setTopologyMetricType(metricType);
    },
    [setTopologyMetricFunction, setTopologyMetricType]
  );

  // Refs
  const drawerRef = React.useRef<NetflowTrafficDrawerHandle>(null);
  const searchRef = React.useRef<SearchHandle>(null);
  const guidedTourRef = React.useRef<GuidedTourHandle>(null);
  const initState = React.useRef<InitState>([]);
  // Stores the user's original metric type before a view preset overrides it
  const savedMetricType = React.useRef<MetricType>(topologyMetricType);

  // Data-fetching hook
  const {
    loading,
    error,
    flows,
    stats,
    metrics,
    metricsRef,
    lastRefresh,
    lastDuration,
    warning,
    chipsPopoverMessage,
    setChipsPopoverMessage,
    topologyUDNIds,
    tick,
    updateTableFilters,
    setFlows,
    setMetrics,
    setError
  } = useDataFetching({
    drawerRef,
    initState,
    caps,
    config,
    selectedViewId,
    range,
    histogramRange,
    showHistogram,
    showDuplicates,
    metricScope,
    topologyMetricType,
    topologyMetricFunction,
    topologyOptions,
    interval,
    isTRModalOpen,
    isOverviewModalOpen,
    isColModalOpen,
    isExportModalOpen,
    filters,
    setFilters,
    parentConfig,
    forcedFilters,
    setConfig,
    queryParams
  });

  // Keep savedMetricType in sync when user is on "All Traffic" and manually changes metric type
  React.useEffect(() => {
    if (activeView === 'all') {
      savedMetricType.current = topologyMetricType;
    }
  }, [topologyMetricType, activeView]);

  const applyView = React.useCallback(
    (viewId: ViewPresetId) => {
      setActiveView(viewId);
      if (viewId === 'all') {
        updateTopologyMetricType(savedMetricType.current);
        return;
      }
      const preset = getViewPreset(viewId);
      if (!preset) {
        return;
      }
      if (preset.topologyMetricType) {
        updateTopologyMetricType(preset.topologyMetricType);
      }
    },
    [setActiveView, updateTopologyMetricType]
  );

  const setColumnsWithDraft = React.useCallback(
    (newColumns: Column[]) => {
      if (activeView === 'all') {
        setColumns(newColumns);
        return;
      }
      // Feature view: merge preset + user selections, create draft only if feature columns differ
      const preset = getViewPreset(activeView);
      const presetColIds = new Set(preset?.columns ?? []);
      const presetColSet = new Set(caps.selectedColumns.map(c => c.id as string));
      const userSelectedIds = newColumns.filter(c => c.isSelected).map(c => c.id as string);
      const mergedColIds = new Set([...presetColSet, ...userSelectedIds]);
      const uncheckedIds = new Set(newColumns.filter(c => !c.isSelected).map(c => c.id as string));
      uncheckedIds.forEach(id => mergedColIds.delete(id));

      // Check if any non-generic (feature) columns differ from preset
      const hasFeatureChanges = newColumns.some(c => {
        if (!c.feature) return false; // generic — handled by generic prefs
        const inPreset = presetColIds.has(c.id);
        return c.isSelected !== inPreset;
      });

      if (hasFeatureChanges) {
        setDraftView(prev => ({
          baseViewId: activeView,
          columns: Array.from(mergedColIds),
          panels: prev?.panels ?? caps.selectedPanels.map(p => p.id as string),
          topologyMetricType: prev?.topologyMetricType ?? topologyMetricType
        }));
      } else {
        // Only clear draft if editing the same view the draft belongs to
        setDraftView(prev => (prev?.baseViewId === activeView ? null : prev));
      }
    },
    [setColumns, activeView, caps.selectedColumns, caps.selectedPanels, topologyMetricType]
  );

  const setPanelsWithDraft = React.useCallback(
    (newPanels: OverviewPanel[]) => {
      if (activeView === 'all') {
        setPanels(newPanels);
        return;
      }
      // Feature view: merge preset + user selections, create draft only if feature panels differ
      const preset = getViewPreset(activeView);
      const presetPanelIds = new Set((preset?.panels ?? []) as string[]);
      const presetPanelSet = new Set(caps.selectedPanels.map(p => p.id as string));
      const userSelectedIds = newPanels.filter(p => p.isSelected).map(p => p.id as string);
      const mergedPanelIds = new Set([...presetPanelSet, ...userSelectedIds]);
      const uncheckedIds = new Set(newPanels.filter(p => !p.isSelected).map(p => p.id as string));
      uncheckedIds.forEach(id => mergedPanelIds.delete(id));

      // Check if any non-generic (feature) panels differ from preset
      const hasFeatureChanges = newPanels.some(p => {
        if (!getPanelFeature(p.id)) return false; // generic — handled by generic prefs
        const inPreset = presetPanelIds.has(p.id);
        return p.isSelected !== inPreset;
      });

      if (hasFeatureChanges) {
        setDraftView(prev => ({
          baseViewId: activeView,
          columns: prev?.columns ?? caps.selectedColumns.map(c => c.id as string),
          panels: Array.from(mergedPanelIds),
          topologyMetricType: prev?.topologyMetricType ?? topologyMetricType
        }));
      } else {
        // Only clear draft if editing the same view the draft belongs to
        setDraftView(prev => (prev?.baseViewId === activeView ? null : prev));
      }
    },
    [setPanels, activeView, caps.selectedColumns, caps.selectedPanels, topologyMetricType]
  );

  // Sync draft with generic prefs changes, or auto-clear if draft matches preset
  React.useEffect(() => {
    if (!draftView) return;
    const preset = getViewPreset(draftView.baseViewId);
    if (!preset?.columns || !preset?.panels) return;

    // Compute expected base: preset + generic prefs (without feature changes)
    const expectedCols = new Set(preset.columns);
    genericColumnPrefs.removed.forEach(id => expectedCols.delete(id));
    genericColumnPrefs.added.forEach(id => expectedCols.add(id));
    const expectedPanels = new Set(preset.panels as string[]);
    genericPanelPrefs.removed.forEach(id => expectedPanels.delete(id));
    genericPanelPrefs.added.forEach(id => expectedPanels.add(id));

    // Detect feature-level differences between draft and expected (preset + generic prefs)
    const presetColSet = new Set(preset.columns);
    const draftColSet = new Set(draftView.columns);
    // Feature columns added to draft (not in preset)
    const addedFeatureCols = draftView.columns.filter(id => {
      const col = caps.availableColumns.find(c => c.id === id);
      return col?.feature && !presetColSet.has(id);
    });
    // Feature columns removed from preset (in preset but not in draft)
    const removedFeatureCols = preset.columns.filter(id => {
      const col = caps.availableColumns.find(c => c.id === id);
      return col?.feature && !draftColSet.has(id);
    });

    const presetPanelSet = new Set(preset.panels as string[]);
    const draftPanelSet = new Set(draftView.panels);
    const addedFeaturePanels = draftView.panels.filter(id => {
      return getPanelFeature(id) && !presetPanelSet.has(id);
    });
    const removedFeaturePanels = (preset.panels as string[]).filter(id => {
      return getPanelFeature(id) && !draftPanelSet.has(id);
    });

    const hasFeatureChanges =
      addedFeatureCols.length > 0 ||
      removedFeatureCols.length > 0 ||
      addedFeaturePanels.length > 0 ||
      removedFeaturePanels.length > 0;

    // If no feature changes remain, clear draft entirely
    if (!hasFeatureChanges) {
      setDraftView(null);
      return;
    }

    // Rebuild draft: expected base + added feature cols - removed feature cols
    const updatedCols = new Set([...expectedCols, ...addedFeatureCols]);
    removedFeatureCols.forEach(id => updatedCols.delete(id));
    const updatedPanels = new Set([...expectedPanels, ...addedFeaturePanels]);
    removedFeaturePanels.forEach(id => updatedPanels.delete(id));

    // Update draft if generic prefs changed its contents
    const colsChanged =
      updatedCols.size !== draftView.columns.length || !draftView.columns.every(id => updatedCols.has(id));
    const panelsChanged =
      updatedPanels.size !== draftView.panels.length || !draftView.panels.every(id => updatedPanels.has(id));

    if (colsChanged || panelsChanged) {
      setDraftView({
        ...draftView,
        columns: Array.from(updatedCols),
        panels: Array.from(updatedPanels)
      });
    }
  }, [draftView, genericColumnPrefs, genericPanelPrefs, caps.availableColumns]);

  const onDiscardDraft = React.useCallback(() => {
    setDraftView(null);
  }, []);

  const resetDefaultFilters = React.useCallback(() => {
    applyView('all');
    updateTableFilters({ match: filters.match, list: caps.defaultFilters });
  }, [filters.match, caps.defaultFilters, updateTableFilters, applyView]);

  const setFiltersFromURL = React.useCallback(() => {
    if (forcedFilters === null) {
      const filtersPromise = getFiltersFromURL(caps.filterDefs, disabledFilters);
      if (filtersPromise) {
        initState.current.push('urlFiltersPending');
        filtersPromise.then(updateTableFilters);
      } else {
        resetDefaultFilters();
      }
    }
  }, [disabledFilters, forcedFilters, caps.filterDefs, resetDefaultFilters, updateTableFilters]);

  const clearFilters = React.useCallback(() => {
    if (forcedFilters) {
      navigate(netflowTrafficPath);
    } else if (filters) {
      //set URL Param to empty value to be able to restore state coming from another page
      const empty: Filters = { ...filters, list: [], match: 'all' };
      setURLFilters(empty);
      updateTableFilters(empty);
    }
  }, [forcedFilters, filters, navigate, updateTableFilters]);

  // Effects

  // Validate and coerce state when config/capabilities change
  useConfigValidation({
    initState,
    config,
    caps,
    filters,
    updateTableFilters,
    recordType,
    setRecordType,
    dataSource,
    setDataSource,
    packetLoss,
    setPacketLoss,
    metricScope,
    setMetricScope,
    topologyMetricType,
    setTopologyMetricType,
    setColumns,
    setPanels,
    setFiltersFromURL,
    activeView,
    setActiveView: applyView
  });

  // Sync state to URL params
  useURLSync({
    initState,
    filters,
    forcedFilters,
    range,
    limit,
    showDuplicates,
    topologyMetricFunction,
    topologyMetricType,
    selectedViewId,
    packetLoss,
    recordType,
    dataSource,
    activeView,
    setQueryParams,
    setTRModalOpen
  });

  // update local storage enabled filters
  React.useEffect(() => {
    if (initState.current.includes('configLoaded')) {
      setDisabledFilters(getDisabledFiltersRecord(filters.list));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Functions
  const clearSelections = () => {
    setTRModalOpen(false);
    setOverviewModalOpen(false);
    setColModalOpen(false);
    setSelectedRecord(undefined);
    setShowQuerySummary(false);
    setSelectedElement(undefined);
  };

  const selectView = (view: ViewId) => {
    clearSelections();
    //save / restore top / limit parameter according to selected view
    if (view === 'overview' && selectedViewId !== 'overview') {
      setLastLimit(limit);
      setLimit(lastTop);
    } else if (view !== 'overview' && selectedViewId === 'overview') {
      setLastTop(limit);
      setLimit(lastLimit);
    }

    if (view !== selectedViewId) {
      setFlows([]);
      setMetrics(defaultNetflowMetrics);
      if (!initState.current.includes('configLoadError')) {
        setError(undefined);
      }
    }
    setSelectedViewId(view);
  };

  // Views
  const actions = () => {
    return (
      <Flex direction={{ default: 'row' }}>
        {caps.availableViews.length > 1 && (
          <FlexItem>
            <Flex direction={{ default: 'column' }}>
              <FlexItem flex={{ default: 'flex_1' }}>
                <ViewSelector
                  activeView={activeView}
                  setActiveView={applyView}
                  draftView={draftView}
                  onDiscardDraft={onDiscardDraft}
                />
              </FlexItem>
            </Flex>
          </FlexItem>
        )}
        <FlexItem flex={{ default: 'flex_1' }}>
          <TimeRangeDropdown
            data-test="time-range-dropdown"
            id="time-range-dropdown"
            range={range}
            setRange={setRange}
            openCustomModal={() => setTRModalOpen(true)}
          />
        </FlexItem>
        <FlexItem flex={{ default: 'flex_1' }}>
          <RefreshDropdown
            data-test="refresh-dropdown"
            id="refresh-dropdown"
            disabled={showHistogram || typeof range !== 'number'}
            interval={interval}
            setInterval={setInterval}
          />
        </FlexItem>
        <FlexItem className="netobserv-refresh-container">
          <Button
            data-test="refresh-button"
            id="refresh-button"
            className="co-action-refresh-button"
            variant="primary"
            onClick={() => tick()}
            icon={<SyncAltIcon style={{ animation: `spin ${loading ? 1 : 0}s linear infinite` }} />}
          />
        </FlexItem>
      </Flex>
    );
  };

  const pageHeader = () => {
    return (
      <div id="pageHeader">
        <Flex direction={{ default: 'row' }}>
          <FlexItem flex={{ default: 'flex_1' }}>
            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Title headingLevel={ContentVariants.h1}>{t('Network Traffic')}</Title>
              </FlexItem>
              <FlexItem>
                <FlowCollectorStatusIndicator />
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem>{actions()}</FlexItem>
        </Flex>
      </div>
    );
  };

  const isShowViewOptions = selectedViewId === 'table' ? showViewOptions && !showHistogram : showViewOptions;

  const fetchCallbacks: FetchCallbacks = React.useMemo(
    () => ({ metricsRef, setFlows, setMetrics, setError }),
    [metricsRef, setFlows, setMetrics, setError]
  );

  const contextValue: NetflowContextValue = React.useMemo(
    () => ({ caps, config, k8sModels, fetchCallbacks }),
    [caps, config, k8sModels, fetchCallbacks]
  );

  return extensions && !_.isEmpty(extensions) ? (
    <NetflowContext.Provider value={contextValue}>
      <PageSection
        hasBodyWrapper={false}
        id="pageSection"
        className={`${isDarkTheme ? 'dark' : 'light'} ${isTab ? 'tab' : ''}`}
      >
        {!hideTitle && pageHeader()}
        {!_.isEmpty(caps.filterDefs) && (
          <Flex direction={{ default: 'row' }} style={{ paddingRight: hideTitle ? '1.5rem' : undefined }}>
            <FlexItem style={{ paddingTop: hideTitle ? '1.8rem' : undefined }} flex={{ default: 'flex_1' }}>
              <FiltersToolbar
                id="filter-toolbar"
                filters={filters}
                forcedFilters={forcedFilters}
                setFilters={updateTableFilters}
                clearFilters={clearFilters}
                resetFilters={resetDefaultFilters}
                queryOptionsProps={{
                  limit,
                  recordType,
                  dataSource,
                  packetLoss,
                  setLimit,
                  setRecordType,
                  setDataSource,
                  setPacketLoss,
                  allowLoki: caps.allowLoki,
                  allowProm: caps.allowProm,
                  allowFlow: caps.isFlow,
                  allowConnection: caps.isConnectionTracking,
                  allowPktDrops: caps.isPktDrop,
                  useTopK: selectedViewId === 'overview'
                }}
                isFullScreen={isFullScreen}
                setFullScreen={setFullScreen}
              />
            </FlexItem>
            {hideTitle && <FlexItem style={{ alignSelf: 'flex-start' }}>{actions()}</FlexItem>}
          </Flex>
        )}
        {
          <TabsContainer
            selectedViewId={selectedViewId}
            showHistogram={showHistogram}
            setShowViewOptions={setShowViewOptions}
            setShowHistogram={setShowHistogram}
            setHistogramRange={setHistogramRange}
            selectView={selectView}
            isShowViewOptions={isShowViewOptions}
            style={{ paddingRight: hideTitle ? '1.5rem' : undefined }}
          />
        }
        {selectedViewId === 'table' && showHistogram && (
          <HistogramToolbar
            loading={loading}
            lastRefresh={lastRefresh}
            limit={limit}
            range={range}
            setRange={setRange}
            histogramRange={histogramRange}
            setHistogramRange={setHistogramRange}
            totalMetric={metrics.totalFlowCount?.result}
            guidedTourHandle={guidedTourRef.current}
            resetRange={() => setRange(defaultTimeRange)}
            tick={tick}
          />
        )}
        {isShowViewOptions && (
          <ViewOptionsToolbar
            size={size}
            overviewFocus={overviewFocus}
            setOverviewFocus={setOverviewFocus}
            selectedViewId={selectedViewId}
            setOverviewModalOpen={setOverviewModalOpen}
            overviewTruncateLength={overviewTruncateLength}
            setOverviewTruncateLength={setOverviewTruncateLength}
            setSize={setSize}
            metricScope={metricScope}
            setMetricScope={updateMetricScope}
            topologyMetricType={topologyMetricType}
            setTopologyMetricType={updateTopologyMetricType}
            topologyMetricFunction={topologyMetricFunction}
            setTopologyMetricFunction={setTopologyMetricFunction}
            topologyOptions={topologyOptions}
            setTopologyOptions={setTopologyOptions}
            setColModalOpen={setColModalOpen}
            setExportModalOpen={setExportModalOpen}
            isViewOptionOverflowMenuOpen={isViewOptionOverflowMenuOpen}
            setViewOptionOverflowMenuOpen={setViewOptionOverflowMenuOpen}
            showDuplicates={showDuplicates}
            setShowDuplicates={setShowDuplicates}
            setSearchEvent={setSearchEvent}
            ref={searchRef}
          />
        )}
        {
          <NetflowTrafficDrawer
            ref={drawerRef}
            error={error}
            currentState={initState.current}
            selectedViewId={selectedViewId}
            limit={limit}
            recordType={recordType}
            metrics={metrics}
            loading={loading}
            overviewTruncateLength={overviewTruncateLength}
            overviewFocus={overviewFocus}
            setOverviewFocus={setOverviewFocus}
            flows={flows}
            selectedRecord={_selectedRecord}
            setColumns={setColumns}
            columnSizes={_columnSizes}
            setColumnSizes={setColumnSizes}
            size={size}
            resetDefaultFilters={resetDefaultFilters}
            clearFilters={clearFilters}
            filters={filters}
            topologyMetricFunction={topologyMetricFunction}
            topologyMetricType={topologyMetricType}
            topologyUDNIds={topologyUDNIds}
            metricScope={metricScope}
            setMetricScope={updateMetricScope}
            topologyOptions={topologyOptions}
            setTopologyOptions={setTopologyOptions}
            setFilters={updateTableFilters}
            selectedElement={_selectedElement}
            searchHandle={searchRef.current}
            searchEvent={_searchEvent}
            isShowQuerySummary={isShowQuerySummary}
            lastRefresh={lastRefresh}
            range={range}
            setRange={setRange}
            setRecordType={setRecordType}
            stats={stats}
            lastDuration={lastDuration}
            warning={warning}
            setShowQuerySummary={setShowQuerySummary}
            clearSelections={clearSelections}
            setSelectedRecord={setSelectedRecord}
            setSelectedElement={setSelectedElement}
          />
        }
        {initState.current.includes('initDone') && (
          <Modals
            isTRModalOpen={isTRModalOpen}
            setTRModalOpen={setTRModalOpen}
            range={range}
            setRange={setRange}
            isOverviewModalOpen={isOverviewModalOpen}
            setOverviewModalOpen={setOverviewModalOpen}
            setPanels={setPanelsWithDraft}
            isColModalOpen={isColModalOpen}
            setColModalOpen={setColModalOpen}
            isExportModalOpen={isExportModalOpen}
            setExportModalOpen={setExportModalOpen}
            recordType={recordType}
            setColumnSizes={setColumnSizes}
            setColumns={setColumnsWithDraft}
            filters={(forcedFilters || filters).list}
            activeView={activeView}
            genericColumnPrefs={genericColumnPrefs}
            setGenericColumnPrefs={setGenericColumnPrefs}
            genericPanelPrefs={genericPanelPrefs}
            setGenericPanelPrefs={setGenericPanelPrefs}
          />
        )}
        <GuidedTourPopover id="netobserv" ref={guidedTourRef} isDark={isDarkTheme} />
        <ChipsPopover chipsPopoverMessage={chipsPopoverMessage} setChipsPopoverMessage={setChipsPopoverMessage} />
      </PageSection>
    </NetflowContext.Provider>
  ) : null;
};

export default NetflowTraffic;
