import {
  CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_NAMES,
  CommandConfigResultWithSubcommands,
} from '../../types';

export interface CommandCategory {
  id: CATEGORIES;
  name: (typeof CATEGORY_NAMES)[CATEGORIES];
  description: (typeof CATEGORY_DESCRIPTIONS)[CATEGORIES];
  commands: CommandConfigResultWithSubcommands[];
}
