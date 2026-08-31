import raw from "../../assessment_files/fixtures/island-media-fixtures.json";
import type { Fixtures } from "./types";

export const fixtures = raw as unknown as Fixtures;

export const fixtureClock = new Date(fixtures.fixtureClock);
