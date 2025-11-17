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
} from "@fullcalendar/core/index.js";

import "../profileCalendar.scss";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

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
    (staffId: string, shiftId: string) => {
      const staffSeed = getStringHash(staffId);
      const shiftSeed = getStringHash(shiftId);

      const hue = (staffSeed + shiftSeed) % 360;
      const saturation = 60 + (shiftSeed % 20);
      const lightness = 45 + (staffSeed % 15);

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
      const colors = getEventColors(assignment.staffId, assignment.shiftId);

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
          <h3>{eventDetails.shiftName}</h3>
          <div className="calendar-modal__info">
            <p>
              <strong>Personel:</strong> {eventDetails.staffName}
            </p>
            <p>
              <strong>Tarih:</strong> {eventDetails.date}
            </p>
            <p>
              <strong>Başlangıç:</strong> {eventDetails.startTime}
            </p>
            <p>
              <strong>Bitiş:</strong> {eventDetails.endTime}
            </p>
            {eventDetails.shiftRule ? (
              <p>
                <strong>Kural:</strong> {eventDetails.shiftRule}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-section">
      <div className="calendar-wrapper">
        <div className="staff-list">
          {schedule?.staffs?.map((staff: any) => (
            <div
              key={staff.id}
              onClick={() => setSelectedStaffId(staff.id)}
              className={`staff ${
                staff.id === selectedStaffId ? "active" : ""
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="20px"
                viewBox="0 -960 960 960"
                width="20px"
              >
                <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17-62.5t47-43.5q60-30 124.5-46T480-440q67 0 131.5 16T736-378q30 15 47 43.5t17 62.5v112H160Zm320-400q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm160 228v92h80v-32q0-11-5-20t-15-14q-14-8-29.5-14.5T640-332Zm-240-21v53h160v-53q-20-4-40-5.5t-40-1.5q-20 0-40 1.5t-40 5.5ZM240-240h80v-92q-15 5-30.5 11.5T260-306q-10 5-15 14t-5 20v32Zm400 0H320h320ZM480-640Z" />
              </svg>
              <span>{staff.name}</span>
            </div>
          ))}
        </div>
        <FullCalendar
          ref={calendarRef}
          locale={auth.language}
          plugins={getPlugins()}
          contentHeight={400}
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
