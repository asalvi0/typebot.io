import { defaultButtonLabel } from "../constants";
import type { ChoiceInputBlock } from "./schema";

export const defaultChoiceInputOptions = {
  buttonLabel: defaultButtonLabel,
  searchInputPlaceholder: "Filter the options...",
  isMultipleChoice: false,
  isSearchable: false,
  areInitialSearchButtonsVisible: true,
} as const satisfies ChoiceInputBlock["options"];
