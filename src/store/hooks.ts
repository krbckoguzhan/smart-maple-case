import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

import type { RootStateInstance } from "./reducer";
import type { AppDispatch } from "./index";

export const useAppDispatch: () => AppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootStateInstance> = useSelector;
