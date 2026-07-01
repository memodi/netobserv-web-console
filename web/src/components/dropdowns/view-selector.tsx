import { Badge, MenuToggle, MenuToggleElement, Select, SelectOption } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ViewPreset, ViewPresetId } from '../../model/views';
import { useOutsideClickEvent } from '../../utils/outside-hook';

// i18n extraction hints for dynamic view labels
// t('All Traffic') t('Packet Drops') t('DNS Latency') t('Flow RTT') t('TLS Tracking') t('UDN Mapping') t('Network Events') t('Packet Translation')

export interface ViewSelectorProps {
  activeView: ViewPresetId;
  setActiveView: (view: ViewPresetId) => void;
  availableViews: ViewPreset[];
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({ activeView, setActiveView, availableViews }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const ref = useOutsideClickEvent(() => setOpen(false));
  const [isOpen, setOpen] = React.useState(false);

  const onSelect = (_: unknown, value: string | number | undefined) => {
    if (value && value !== activeView) {
      setActiveView(value as ViewPresetId);
    }
    setOpen(false);
  };

  const activeLabel = availableViews.find(v => v.id === activeView)?.label ?? t('All Traffic');
  const isNonDefault = activeView !== 'all';

  return (
    <div id="view-selector-container" data-test="view-selector-container" ref={ref}>
      <Select
        data-test="view-selector-dropdown"
        id="view-selector-dropdown"
        isOpen={isOpen}
        onSelect={onSelect}
        selected={activeView}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle ref={toggleRef} onClick={() => setOpen(!isOpen)} isExpanded={isOpen}>
            <>
              {t('View')}: {t(activeLabel)}
              {isNonDefault && <Badge isRead>{1}</Badge>}
            </>
          </MenuToggle>
        )}
      >
        {availableViews.map(view => (
          <SelectOption
            key={view.id}
            value={view.id}
            isSelected={activeView === view.id}
            id={`view-option-${view.id}`}
            data-test={`view-option-${view.id}`}
          >
            {t(view.label)}
          </SelectOption>
        ))}
      </Select>
    </div>
  );
};
