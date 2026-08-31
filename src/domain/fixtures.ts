import raw from "../../assessment_files/fixtures/island-media-fixtures.json";
import { fixturesSchema } from "./schemas";

export const fixtures = fixturesSchema.parse(raw);

export const fixtureClock = new Date(fixtures.fixtureClock);
