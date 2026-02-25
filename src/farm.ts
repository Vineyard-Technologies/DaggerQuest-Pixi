import { AreaLoader, type AreaDefinition } from './areaLoader';
import farmData from './data/farm.json';

/**
 * The Farm area – the starting zone for the player.
 * All layout data lives in `src/data/farm.json`.
 */
class Farm extends AreaLoader {
    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        super(farmData as unknown as AreaDefinition);
    }
}

export { Farm };
