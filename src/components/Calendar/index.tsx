/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { ScheduleInstance } from "../../models/schedule";
import type { UserInstance } from "../../models/user";

import FullCalendar from "@fullcalendar/react";

import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

import type {
  EventClickArg,
  EventContentArg,
  EventInput,
  EventDropArg,
} from "@fullcalendar/core/index.js";

import { Select, MenuItem, FormControl, InputLabel } from "@mui/material";

import "../profileCalendar.scss";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

import { updateAssignmentDate } from "../../store/schedule/actions";
import { useAppDispatch } from "../../store/hooks";

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);

type CalendarContainerProps = {
  schedule: ScheduleInstance;
  auth: UserInstance;
};

type CalendarEventDetails = {
  id: string;
  staffName: string;
  shiftName: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftRule?: string;
};

type PairHighlightInfo = {
  staffId: string;
  staffName: string;
  color: string;
};

type PairHighlightMap = Record<string, PairHighlightInfo[]>;

type DayCellStyle = CSSProperties & {
  "--pair-color"?: string;
};

const CalendarContainer = ({ schedule, auth }: CalendarContainerProps) => {
  const dispatch = useAppDispatch();
  const calendarRef = useRef<FullCalendar>(null);

  const [events, setEvents] = useState<EventInput[]>([]);
  const [highlightedDates, setHighlightedDates] = useState<string[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [pairHighlightMap, setPairHighlightMap] = useState<PairHighlightMap>({});
  const [initialDate, setInitialDate] = useState<Date>(
    dayjs(schedule?.scheduleStartDate).toDate()
  );
  const [activeEventDetails, setActiveEventDetails] =
    useState<CalendarEventDetails | null>(null);

  const validDateList = useMemo(() => {
    if (!schedule?.scheduleStartDate || !schedule?.scheduleEndDate) return [];

    const dates: string[] = [];
    let currentDate = dayjs(schedule.scheduleStartDate);
    const endDate = dayjs(schedule.scheduleEndDate);

    while (currentDate.isSame(endDate) || currentDate.isBefore(endDate)) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate = currentDate.add(1, "day");
    }

    return dates;
  }, [schedule?.scheduleStartDate, schedule?.scheduleEndDate]);

  const validDateSet = useMemo(() => new Set(validDateList), [validDateList]);

  const getStringHash = useCallback((value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, []);

  const getEventColors = useCallback(
    (staffId: string) => {
      const seed = getStringHash(staffId);
      const hue = seed % 360;
      const saturation = 70;
      const lightness = 45 + (seed % 10);

      const background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      const border = `hsl(${hue}, ${Math.min(
        saturation + 10,
        85
      )}%, ${Math.max(lightness - 12, 30)}%)`;
      const text = lightness > 60 ? "#0f172a" : "#ffffff";

      return {
        background,
        border,
        text,
      };
    },
    [getStringHash]
  );

  const getStaffHighlightColor = useCallback(
    (staffId: string) => {
      const seed = getStringHash(staffId);
      const hue = seed % 360;
      const saturation = 70;
      const lightness = 45 + (seed % 10);

      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    },
    [getStringHash]
  );

  const getPlugins = () => {
    const plugins = [dayGridPlugin];

    plugins.push(interactionPlugin);
    return plugins;
  };

  useEffect(() => {
    if (!schedule?.staffs?.length) return;

    setInitialDate(dayjs(schedule.scheduleStartDate).toDate());
  }, [schedule?.scheduleStartDate, schedule?.staffs?.length]);

  useEffect(() => {
    if (!schedule?.staffs?.length) return;

    const firstStaffId = schedule.staffs[0].id;
    const selectedExists = schedule.staffs.some(
      (staff) => staff.id === selectedStaffId
    );

    if (!selectedStaffId || !selectedExists) {
      setSelectedStaffId(firstStaffId);
    }
  }, [schedule?.staffs, selectedStaffId]);

  useEffect(() => {
    if (!schedule || !selectedStaffId) {
      setEvents([]);
      setHighlightedDates([]);
      setPairHighlightMap({});
      return;
    }

    const currentStaff = schedule.staffs?.find(
      (staff) => staff.id === selectedStaffId
    );
    const offDays = currentStaff?.offDays || [];

    const filteredAssignments =
      schedule.assignments?.filter(
        (assign) => assign.staffId === selectedStaffId
      ) || [];

    const works: EventInput[] = filteredAssignments.map((assignment) => {
      const shift = schedule.shifts?.find(
        (item) => item.id === assignment.shiftId
      );
      const startDate = dayjs.utc(assignment.shiftStart).toDate();
      const endDate = dayjs.utc(assignment.shiftEnd).toDate();
      const formattedDate = dayjs(startDate).format("YYYY-MM-DD");
      const isValidDate = validDateSet.has(formattedDate);
      const colors = getEventColors(assignment.staffId);

      return {
        id: assignment.id,
        title: shift?.name ?? "Vardiya",
        start: startDate,
        end: endDate,
        allDay: false,
        backgroundColor: colors.background,
        borderColor: colors.border,
        textColor: colors.text,
        display: "block",
        className: `event ${assignment.isUpdated ? "highlight" : ""} ${
          !isValidDate ? "invalid-date" : ""
        }`,
        extendedProps: {
          staffName: currentStaff?.name ?? "",
          shiftName: shift?.name ?? "",
          shiftRule: shift?.shiftRule ?? "",
          rawStart: assignment.shiftStart,
          rawEnd: assignment.shiftEnd,
        },
      };
    });

    const staffHighlightedDates = validDateList
      .map((date) => dayjs(date, "YYYY-MM-DD"))
      .filter((day) => offDays.includes(day.format("DD.MM.YYYY")))
      .map((day) => day.format("DD-MM-YYYY"));

    const highlightedPairs: PairHighlightMap = {};

    (currentStaff?.pairList ?? []).forEach((pair: any) => {
      if (!pair?.startDate || !pair?.endDate || !pair?.staffId) return;

      const start = dayjs(pair.startDate, "DD.MM.YYYY");
      const end = dayjs(pair.endDate, "DD.MM.YYYY");

      if (!start.isValid() || !end.isValid()) return;

      const pairStaff = schedule.staffs?.find(
        (staff) => staff.id === pair.staffId
      );

      let cursor = start;
      const color = getStaffHighlightColor(pair.staffId);

      while (cursor.isSame(end) || cursor.isBefore(end)) {
        const isoDate = cursor.format("YYYY-MM-DD");

        if (validDateSet.has(isoDate)) {
          if (!highlightedPairs[isoDate]) highlightedPairs[isoDate] = [];

          highlightedPairs[isoDate].push({
            staffId: pair.staffId,
            staffName: pairStaff?.name ?? "",
            color,
          });
        }

        cursor = cursor.add(1, "day");
      }
    });

    setHighlightedDates(staffHighlightedDates);
    setPairHighlightMap(highlightedPairs);
    setEvents(works);
  }, [
    getEventColors,
    getStaffHighlightColor,
    schedule,
    selectedStaffId,
    validDateList,
    validDateSet,
  ]);

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      if (!info.event.start) {
        info.revert();
        return;
      }

      const assignment = schedule?.assignments?.find(
        (item) => item.id === info.event.id
      );

      if (!assignment) {
        info.revert();
        return;
      }

      const dropDate = dayjs(info.event.start);
      const dropDateIso = dropDate.format("YYYY-MM-DD");

      if (!validDateSet.has(dropDateIso)) {
        info.revert();
        return;
      }

      const assignmentDuration = dayjs(assignment.shiftEnd).diff(
        dayjs(assignment.shiftStart)
      );

      const newStart = dropDate.utc();
      const computedEnd = info.event.end
        ? dayjs(info.event.end)
        : dropDate.add(assignmentDuration, "millisecond");
      const newEnd = computedEnd.utc();

      dispatch(
        updateAssignmentDate({
          assignmentId: assignment.id,
          shiftStart: newStart.toISOString(),
          shiftEnd: newEnd.toISOString(),
        }) as any
      );
    },
    [dispatch, schedule?.assignments, validDateSet]
  );

  const handleEventClick = (eventInfo: EventClickArg) => {
    eventInfo.jsEvent?.preventDefault();
    const { extendedProps } = eventInfo.event;

    setActiveEventDetails({
      id: eventInfo.event.id,
      staffName: extendedProps.staffName ?? "",
      shiftName: extendedProps.shiftName ?? eventInfo.event.title,
      date: dayjs(eventInfo.event.start).format("DD.MM.YYYY"),
      startTime: dayjs(eventInfo.event.start).format("HH:mm"),
      endTime: dayjs(eventInfo.event.end ?? eventInfo.event.start).format(
        "HH:mm"
      ),
      shiftRule: extendedProps.shiftRule,
    });
  };

  const closeEventModal = () => setActiveEventDetails(null);

  const RenderEventContent = ({
    eventInfo,
  }: {
    eventInfo: EventContentArg;
  }) => {
    return (
      <div className="event-content">
        <p>
          {eventInfo.event.start
            ? `${dayjs(eventInfo.event.start).format("HH:mm")} · `
            : ""}
          {eventInfo.event.title}
        </p>
      </div>
    );
  };

  const EventDetailModal = ({
    eventDetails,
    onClose,
  }: {
    eventDetails: CalendarEventDetails | null;
    onClose: () => void;
  }) => {
    if (!eventDetails) return null;

    const calculateDuration = () => {
      const start = dayjs(`2000-01-01 ${eventDetails.startTime}`);
      const end = dayjs(`2000-01-01 ${eventDetails.endTime}`);
      const diff = end.diff(start, 'minute');
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      return `${hours} saat ${minutes > 0 ? `${minutes} dakika` : ''}`;
    };

    return (
      <div
        className="calendar-modal-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="calendar-modal"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="calendar-modal__close"
            onClick={onClose}
            aria-label="close event details"
          >
            ×
          </button>
          
          <div className="calendar-modal__header">
            <h3>{eventDetails.shiftName}</h3>
            <p>Vardiya Detayları</p>
          </div>

          <div className="calendar-modal__body">
            <div className="calendar-modal__info-item person">
              <div className="info-icon">👤</div>
              <div className="info-content">
                <p className="info-label">Personel</p>
                <p className="info-value">{eventDetails.staffName}</p>
              </div>
            </div>

            <div className="calendar-modal__info-item date">
              <div className="info-icon">📅</div>
              <div className="info-content">
                <p className="info-label">Tarih</p>
                <p className="info-value">{eventDetails.date}</p>
              </div>
            </div>

            <div className="calendar-modal__info-item start-time">
              <div className="info-icon">🕐</div>
              <div className="info-content">
                <p className="info-label">Başlangıç</p>
                <p className="info-value">{eventDetails.startTime}</p>
              </div>
            </div>

            <div className="calendar-modal__info-item end-time">
              <div className="info-icon">🕐</div>
              <div className="info-content">
                <p className="info-label">Bitiş</p>
                <p className="info-value">{eventDetails.endTime}</p>
              </div>
            </div>

            {eventDetails.shiftRule && (
              <div className="calendar-modal__info-item rule">
                <div className="info-icon">🛡️</div>
                <div className="info-content">
                  <p className="info-label">Kural</p>
                  <p className="info-value">{eventDetails.shiftRule}</p>
                </div>
              </div>
            )}
          </div>

          <div className="calendar-modal__footer">
            Toplam Süre: {calculateDuration()}
          </div>
        </div>
      </div>
    );
  };

  const getStaffColor = useCallback(
    (staffId: string) => {
      const colors = getEventColors(staffId);
      return colors?.background;
    },
    [getEventColors]
  );

  return (
    <div className="calendar-section">
      <div className="calendar-wrapper">
        <div className="staff-list">
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="staff-select-label">Personel Seçin</InputLabel>
            <Select
              labelId="staff-select-label"
              id="staff-select"
              value={selectedStaffId || ""}
              label="Personel Seçin"
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              {schedule?.staffs?.map((staff: any) => (
                <MenuItem key={staff.id} value={staff.id}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      style={{ 
                        display: 'inline-block',
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '3px',
                        backgroundColor: getStaffColor(staff.id),
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}
                    />
                    <span>{staff.name}</span>
                  </span>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        <FullCalendar
          ref={calendarRef}
          locale={auth.language}
          plugins={getPlugins()}
          contentHeight={500}
          handleWindowResize={true}
          selectable={true}
          editable={true}
          eventOverlap={true}
          eventDurationEditable={false}
          initialView="dayGridMonth"
          initialDate={initialDate}
          events={events}
          firstDay={1}
          dayMaxEventRows={4}
          fixedWeekCount={true}
          showNonCurrentDates={true}
          eventContent={(eventInfo: EventContentArg) => (
            <RenderEventContent eventInfo={eventInfo} />
          )}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          datesSet={(info: any) => {
            const prevButton = document.querySelector(
              ".fc-prev-button"
            ) as HTMLButtonElement;
            const nextButton = document.querySelector(
              ".fc-next-button"
            ) as HTMLButtonElement;

            if (
              calendarRef?.current?.getApi().getDate() &&
              !dayjs(schedule?.scheduleStartDate).isSame(
                calendarRef?.current?.getApi().getDate()
              )
            )
              setInitialDate(calendarRef?.current?.getApi().getDate());

            const startDiff = dayjs(info.start)
              .utc()
              .diff(
                dayjs(schedule.scheduleStartDate).subtract(1, "day").utc(),
                "days"
              );
            const endDiff = dayjs(dayjs(schedule.scheduleEndDate)).diff(
              info.end,
              "days"
            );
            if (startDiff < 0 && startDiff > -35) prevButton.disabled = true;
            else prevButton.disabled = false;

            if (endDiff < 0 && endDiff > -32) nextButton.disabled = true;
            else nextButton.disabled = false;
          }}
          dayCellContent={({ date }) => {
            const isoDate = dayjs(date).format("YYYY-MM-DD");
            const found = validDateSet.has(isoDate);
            const isHighlighted = highlightedDates.includes(
              dayjs(date).format("DD-MM-YYYY")
            );
            const pairHighlightsForDay = pairHighlightMap[isoDate] ?? [];
            const pairColor = pairHighlightsForDay[0]?.color;

            const cellStyle: DayCellStyle | undefined = pairColor
              ? { "--pair-color": pairColor }
              : undefined;

            return (
              <div
                className={`${found ? "" : "date-range-disabled"} ${
                  isHighlighted ? "highlighted-date-orange" : ""
                } ${pairColor ? "highlightedPair" : ""}`}
                style={cellStyle}
              >
                {dayjs(date).date()}
              </div>
            );
          }}
        />
      </div>
      <EventDetailModal
        eventDetails={activeEventDetails}
        onClose={closeEventModal}
      />
    </div>
  );
};

export default CalendarContainer;
