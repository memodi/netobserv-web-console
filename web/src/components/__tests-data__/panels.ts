import * as _ from 'lodash';
import { getDefaultOverviewPanels, OverviewPanel } from '../../utils/overview-panels';

export const CustomPanelsSample = ['Flows', 'DnsFlows'];
export const SamplePanel = { id: 'top_avg_byte_rates', isSelected: true } as OverviewPanel;
export const DefaultPanels = getDefaultOverviewPanels().filter(p => p.isSelected);
// Use a fixed set for modal tests to avoid shuffle-order flakiness
export const ShuffledDefaultPanels: OverviewPanel[] = [
  { id: 'top_avg_byte_rates', isSelected: true },
  { id: 'byte_rates', isSelected: true },
  { id: 'top_sankey', isSelected: true },
  { id: 'overview', isSelected: true },
  { id: 'inbound_region', isSelected: true }
];
