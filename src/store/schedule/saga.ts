/* eslint-disable @typescript-eslint/no-unused-expressions */
import type { AxiosResponse } from 'axios';
import type { Action } from 'redux-actions';

import { put, takeEvery } from 'redux-saga/effects';

import types from './types';
import Logger from '../../utils/logger';
import * as actions from './actions';
import { updateProgress } from '../ui/actions';

import type { Callbacks } from '../../utils/types';
import { scheduleReponse } from '../../constants/api';
import type { ScheduleInstance } from '../../models/schedule';
import {
  loadScheduleFromStorage,
  saveScheduleToStorage,
} from '../../utils/scheduleStorage';

function* asyncFetchSchedule({
  payload: { onSuccess, onError } = {},
}: Action<
  Callbacks
>) {
  yield put(updateProgress());
  try {
    const storedSchedule = loadScheduleFromStorage();

    if (storedSchedule) {
      yield put(actions.fetchScheduleSuccess(storedSchedule));
      onSuccess &&
        onSuccess({ data: storedSchedule } as unknown as AxiosResponse);
      return;
    }

    const response = scheduleReponse;
    const scheduleData = response.data as unknown as ScheduleInstance;
    yield put(actions.fetchScheduleSuccess(scheduleData));
    saveScheduleToStorage(scheduleData);

    onSuccess && onSuccess(response);
  } catch (err) {
    Logger.error(err);
    onError && onError(err);

    yield put(actions.fetchScheduleFailed());
  } finally {
    yield put(updateProgress(false));
  }
}

const scheduleSagas = [
  takeEvery(types.FETCH_SCHEDULE, asyncFetchSchedule),
];

export default scheduleSagas;
