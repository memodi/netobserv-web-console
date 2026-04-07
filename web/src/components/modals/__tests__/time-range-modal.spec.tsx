import { act, fireEvent, render } from '@testing-library/react';
import * as React from 'react';

import { TimeRange } from '../../../utils/datetime';
import TimeRangeModal, { TimeRangeModalProps } from '../time-range-modal';

describe('<TimeRangeModal />', () => {
  const props: TimeRangeModalProps = {
    isModalOpen: true,
    setModalOpen: jest.fn(),
    range: undefined,
    setRange: jest.fn(),
    id: 'time-range-modal'
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render component', async () => {
    render(<TimeRangeModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should save once', async () => {
    render(<TimeRangeModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });

    const confirmButton = document.querySelector('.pf-v5-c-button.pf-m-primary') as HTMLElement;
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(confirmButton);
      jest.runAllTimers();
    });
    expect(props.setRange).toHaveBeenCalledTimes(1);
  });

  it('should update range on save', async () => {
    const nowRange: TimeRange = {
      from: new Date().setHours(0, 0, 0, 0) / 1000,
      to: new Date().setHours(23, 59, 0, 0) / 1000
    };

    render(<TimeRangeModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });

    const fromDateInput = document.querySelector('[data-test="from-date-picker"] input') as HTMLInputElement;
    const fromTimeInput = document.querySelector('[data-test="from-time-picker"] input') as HTMLInputElement;
    const toDateInput = document.querySelector('[data-test="to-date-picker"] input') as HTMLInputElement;
    const toTimeInput = document.querySelector('[data-test="to-time-picker"] input') as HTMLInputElement;
    const saveButton = document.querySelector('[data-test="time-range-save"]') as HTMLElement;

    // Set start date & time and press save
    await act(async () => {
      fireEvent.change(fromDateInput, { target: { value: '2021-12-01' } });
      fireEvent.change(fromTimeInput, { target: { value: '10:15:30' } });
      jest.runAllTimers();
    });
    nowRange.from = new Date(2021, 11, 1, 10, 15, 30, 0).getTime() / 1000;

    await act(async () => {
      fireEvent.click(saveButton);
      jest.runAllTimers();
    });
    expect(props.setRange).toHaveBeenNthCalledWith(1, nowRange);

    // Set end date & time and press save
    await act(async () => {
      fireEvent.change(toDateInput, { target: { value: '2021-12-15' } });
      fireEvent.change(toTimeInput, { target: { value: '23:00:00' } });
      jest.runAllTimers();
    });
    nowRange.to = new Date(2021, 11, 15, 23, 0, 0, 0).getTime() / 1000;

    await act(async () => {
      fireEvent.click(saveButton);
      jest.runAllTimers();
    });
    expect(props.setRange).toHaveBeenNthCalledWith(2, nowRange);
  });

  it('should allow same day with different times (NETOBSERV-2665)', async () => {
    render(<TimeRangeModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });

    const fromDateInput = document.querySelector('[data-test="from-date-picker"] input') as HTMLInputElement;
    const fromTimeInput = document.querySelector('[data-test="from-time-picker"] input') as HTMLInputElement;
    const toDateInput = document.querySelector('[data-test="to-date-picker"] input') as HTMLInputElement;
    const toTimeInput = document.querySelector('[data-test="to-time-picker"] input') as HTMLInputElement;
    const saveButton = document.querySelector('[data-test="time-range-save"]') as HTMLElement;

    await act(async () => {
      fireEvent.change(fromDateInput, { target: { value: '2026-03-12' } });
      fireEvent.change(fromTimeInput, { target: { value: '10:00:00' } });
      fireEvent.change(toDateInput, { target: { value: '2026-03-12' } });
      fireEvent.change(toTimeInput, { target: { value: '10:30:00' } });
      jest.runAllTimers();
    });

    await act(async () => {
      fireEvent.click(saveButton);
      jest.runAllTimers();
    });

    const expectedRange: TimeRange = {
      from: new Date(2026, 2, 12, 10, 0, 0, 0).getTime() / 1000,
      to: new Date(2026, 2, 12, 10, 30, 0, 0).getTime() / 1000
    };
    expect(props.setRange).toHaveBeenCalledWith(expectedRange);
  });
});
