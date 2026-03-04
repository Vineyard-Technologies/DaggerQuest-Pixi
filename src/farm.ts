import { loadArea, type AreaDefinition } from './areaLoader';
import type { Area } from './area';
import farmData from './data/farm.json';

/**
 * Create the Farm area – the starting zone for the player.
 * All layout data lives in `src/data/farm.json`.
 */
export function createFarm(): Promise<Area> {
    return loadArea(farmData as unknown as AreaDefinition);
}
