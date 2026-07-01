import { Feature } from './config';
import { ColumnsId } from '../utils/columns';
import { OverviewPanelId } from '../utils/overview-panels';
import { MetricType } from './flow-query';

export type ViewPresetId =
  | 'all'
  | 'pktdrop'
  | 'dns'
  | 'rtt'
  | 'tls'
  | 'udn'
  | 'networkEvents'
  | 'packetTranslation';

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
  ColumnsId.starttime,
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
      'name_dns_latency_flows',
      'rcode_dns_latency_flows'
    ],
    columns: [
      ...baseColumns,
      ColumnsId.dnsid,
      ColumnsId.dnslatency,
      ColumnsId.dnsresponsecode,
      ColumnsId.dnserrno
    ],
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
    columns: [...baseColumns, ColumnsId.bytes, ColumnsId.packets, ColumnsId.dropstate, ColumnsId.dropcause]
  },
  {
    id: 'packetTranslation',
    label: 'Packet Translation',
    requiredFeature: 'packetTranslation',
    panels: ['top_sankey', 'top_avg_byte_rates', 'byte_rates'],
    columns: [
      ColumnsId.starttime,
      ColumnsId.srcnamespace,
      ColumnsId.srcname,
      ColumnsId.srcaddr,
      ColumnsId.srcport,
      ColumnsId.dstnamespace,
      ColumnsId.dstname,
      ColumnsId.dstaddr,
      ColumnsId.dstport,
      ColumnsId.proto,
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
