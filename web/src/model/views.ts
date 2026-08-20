import { Column, ColumnsId } from '../utils/columns';
import { getPanelFeature, OverviewPanelId } from '../utils/overview-panels';
import { Feature } from './config';
import { MetricType } from './flow-query';

export type ViewPresetId = 'all' | 'pktdrop' | 'dns' | 'rtt' | 'tls' | 'udn' | 'networkEvents' | 'packetTranslation';

export interface DraftView {
  baseViewId: ViewPresetId;
  panels: string[];
  columns: string[];
  topologyMetricType?: MetricType;
}

export interface GenericPrefs {
  added: string[]; // generic IDs user added (not in defaults)
  removed: string[]; // generic IDs user removed (were in defaults)
}

export const defaultGenericPrefs: GenericPrefs = { added: [], removed: [] };

export interface ViewPreset {
  id: ViewPresetId;
  label: string; // i18n key
  requiredFeature?: Feature;
  panels?: OverviewPanelId[]; // panels to select in overview; undefined means use localStorage defaults
  columns?: string[]; // column IDs to select in table; string to support both ColumnsId enum and dynamic string IDs
  topologyMetricType?: MetricType; // default metric for topology
}

// Common base columns included in every feature view
const baseColumns: ColumnsId[] = [
  ColumnsId.endtime,
  ColumnsId.srcnamespace,
  ColumnsId.srcname,
  ColumnsId.dstnamespace,
  ColumnsId.dstname,
  ColumnsId.proto,
  ColumnsId.srcport,
  ColumnsId.dstport
];

export const viewPresets: ViewPreset[] = [
  {
    id: 'all',
    label: 'All Traffic'
    // no requiredFeature, no panels/columns override — uses localStorage defaults
  },
  {
    id: 'pktdrop',
    label: 'Packet Drops',
    requiredFeature: 'pktDrop',
    panels: [
      'top_avg_dropped_packet_rates',
      'dropped_packet_rates',
      'state_dropped_packet_rates',
      'cause_dropped_packet_rates',
      'top_avg_dropped_byte_rates',
      'dropped_byte_rates'
    ],
    columns: [
      ...baseColumns,
      ColumnsId.bytes,
      ColumnsId.packets,
      ColumnsId.dropbytes,
      ColumnsId.droppackets,
      ColumnsId.dropstate,
      ColumnsId.dropcause,
      ColumnsId.dropflags
    ],
    topologyMetricType: 'PktDropPackets'
  },
  {
    id: 'dns',
    label: 'DNS Latency',
    requiredFeature: 'dnsTracking',
    panels: [
      'top_avg_dns_latency',
      'top_p90_dns_latency',
      'top_p99_dns_latency',
      'top_max_dns_latency',
      'dns_name_flows',
      'dns_rcode_flows'
    ],
    columns: [...baseColumns, ColumnsId.dnsid, ColumnsId.dnslatency, ColumnsId.dnsresponsecode, ColumnsId.dnserrno],
    topologyMetricType: 'DnsLatencyMs'
  },
  {
    id: 'rtt',
    label: 'Flow RTT',
    requiredFeature: 'flowRTT',
    panels: ['top_avg_rtt', 'top_p90_rtt', 'top_p99_rtt', 'top_max_rtt', 'bottom_min_rtt'],
    columns: [...baseColumns, ColumnsId.bytes, ColumnsId.packets, ColumnsId.rttTime],
    topologyMetricType: 'TimeFlowRttNs'
  },
  {
    id: 'tls',
    label: 'TLS Tracking',
    requiredFeature: 'tlsTracking',
    panels: ['tls_usage_global', 'tls_per_version', 'tls_per_group', 'tls_per_cipher_suite'],
    columns: [...baseColumns, 'TLSVersion', 'TLSCipherSuite', 'TLSGroup', ColumnsId.tlstypes],
    topologyMetricType: 'TlsFlows'
  },
  {
    id: 'udn',
    label: 'UDN Mapping',
    requiredFeature: 'udnMapping',
    panels: ['top_sankey', 'top_avg_byte_rates', 'byte_rates'],
    columns: [...baseColumns, ColumnsId.udns, ColumnsId.bytes, ColumnsId.packets]
  },
  {
    id: 'networkEvents',
    label: 'Network Events',
    requiredFeature: 'networkEvents',
    panels: [
      'top_avg_dropped_packet_rates',
      'dropped_packet_rates',
      'state_dropped_packet_rates',
      'cause_dropped_packet_rates'
    ],
    columns: [
      ...baseColumns,
      ColumnsId.bytes,
      ColumnsId.packets,
      ColumnsId.dropstate,
      ColumnsId.dropcause,
      'NetworkEvents'
    ]
  },
  {
    id: 'packetTranslation',
    label: 'Packet Translation',
    requiredFeature: 'packetTranslation',
    panels: ['top_sankey', 'top_avg_byte_rates', 'byte_rates'],
    columns: [
      ...baseColumns,
      ColumnsId.srcaddr,
      ColumnsId.dstaddr,
      ColumnsId.bytes,
      ColumnsId.packets,
      'XlatSrcAddr',
      'XlatSrcPort',
      'XlatSrcK8S_Object',
      'XlatDstAddr',
      'XlatDstPort',
      'XlatDstK8S_Object',
      'XlatZoneId'
    ]
  }
];

export const getViewPreset = (id: ViewPresetId): ViewPreset | undefined => viewPresets.find(v => v.id === id);

export const getAvailableViews = (enabledFeatures: Feature[]): ViewPreset[] =>
  viewPresets.filter(v => !v.requiredFeature || enabledFeatures.includes(v.requiredFeature));

/**
 * Reconcile a draft view with current generic preferences.
 * Returns updated DraftView, or null if no feature-level changes remain (draft should be cleared).
 */
export const reconcileDraftWithGenericPrefs = (
  draft: DraftView,
  genericColumnPrefs: GenericPrefs,
  genericPanelPrefs: GenericPrefs,
  availableColumns: Column[]
): DraftView | null => {
  const preset = getViewPreset(draft.baseViewId);
  if (!preset?.columns || !preset?.panels) return draft;

  // Compute expected base: preset + generic prefs
  const expectedCols = new Set(preset.columns);
  genericColumnPrefs.removed.forEach(id => expectedCols.delete(id));
  genericColumnPrefs.added.forEach(id => expectedCols.add(id));
  const expectedPanels = new Set(preset.panels as string[]);
  genericPanelPrefs.removed.forEach(id => expectedPanels.delete(id));
  genericPanelPrefs.added.forEach(id => expectedPanels.add(id));

  // Detect feature-level differences between draft and expected
  const presetColSet = new Set(preset.columns);
  const draftColSet = new Set(draft.columns);
  const addedFeatureCols = draft.columns.filter(id => {
    const col = availableColumns.find(c => c.id === id);
    return col?.feature && !presetColSet.has(id);
  });
  const removedFeatureCols = preset.columns.filter(id => {
    const col = availableColumns.find(c => c.id === id);
    return col?.feature && !draftColSet.has(id);
  });

  const presetPanelSet = new Set(preset.panels as string[]);
  const draftPanelSet = new Set(draft.panels);
  const addedFeaturePanels = draft.panels.filter(id => getPanelFeature(id) && !presetPanelSet.has(id));
  const removedFeaturePanels = (preset.panels as string[]).filter(id => getPanelFeature(id) && !draftPanelSet.has(id));

  const hasFeatureChanges =
    addedFeatureCols.length > 0 ||
    removedFeatureCols.length > 0 ||
    addedFeaturePanels.length > 0 ||
    removedFeaturePanels.length > 0;

  if (!hasFeatureChanges) return null;

  // Rebuild draft: expected base + feature changes
  const updatedCols = new Set([...expectedCols, ...addedFeatureCols]);
  removedFeatureCols.forEach(id => updatedCols.delete(id));
  const updatedPanels = new Set([...expectedPanels, ...addedFeaturePanels]);
  removedFeaturePanels.forEach(id => updatedPanels.delete(id));

  return {
    ...draft,
    columns: Array.from(updatedCols),
    panels: Array.from(updatedPanels)
  };
};
