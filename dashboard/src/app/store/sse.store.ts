import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { injectParams } from 'ngxtension/inject-params';
import { environment } from '../../environments/environment';
import { computed, inject } from '@angular/core';
import {
  CommandCategory,
  CommandConfig,
  GuildChannel,
  GuildInfo,
  GuildRole,
  GuildService,
} from '../core/services/guild.service';
import { pipe, switchMap } from 'rxjs';
import { Router } from '@angular/router';

interface CacheStore {
  source: EventSource | null;
  guildId: string | null;
  lastEvent: string | null;
  retryCount: number;
  commands: Map<number, CommandConfig>;
  roles: GuildRole[];
  channels: GuildChannel[];
  isLoading: boolean;
  error: string | null;
  guildInfo: GuildInfo | null;
}

const initialState: CacheStore = {
  source: null,
  guildId: null,
  lastEvent: null,
  retryCount: 0,
  commands: new Map<number, CommandConfig>(),
  roles: [],
  channels: [],
  isLoading: false,
  error: null,
  guildInfo: null,
};

export const CacheStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const router = inject(Router);
    const obj = {
      retryConnection: () => {
        if (store.retryCount() === 5) {
          store.source()?.close();
          return;
        }

        if (store.source()) {
          store.source()?.close();
        }

        obj.createSource();

        patchState(store, {
          retryCount: store.retryCount() + 1,
        });
      },
      createSource: () => {
        const source = new EventSource(
          `${environment.apiUrl}/guilds/${store.guildId()}/events`,
          {
            withCredentials: true,
          }
        );

        source.addEventListener('open', () => {
          patchState(store, {
            lastEvent: 'Connected',
            retryCount: 0,
          });
        });

        source.addEventListener('update', (evt: MessageEvent) => {
          try {
            patchState(store, {
              lastEvent: evt.data,
            });
            const event = JSON.parse(evt.data);

            switch (event.type) {
              case 'command.config.update':
                const copy = new Map(store.commands());
                const command = copy.get(event.command.id);
                if (!command) {
                  console.error(
                    `[Dashboard] Command ${event.command.id} not found in cache`
                  );
                  break;
                }

                const newCommand = {
                  ...command,
                  ...event.command,
                };

                copy.set(event.command.id, newCommand);

                patchState(store, {
                  commands: copy,
                });
                break;
              case 'initial':
                patchState(store, {
                  guildInfo: event.guildInfo,
                  roles: event.roles,
                  channels: event.channels,
                  commands: (event.commands as CommandConfig[]).reduce(
                    (acc, command) => {
                      acc.set(command.id, command);
                      return acc;
                    },
                    new Map<number, CommandConfig>()
                  ),
                });
                break;
              case 'guild_fetch_failed':
                console.error(`[Dashboard] Guild fetch failed for ${event.guildId}:`, event.error);
                patchState(store, {
                  error: `Failed to load guild data: ${event.error}`,
                });
                store.source()?.close();
                router.navigate(['/servers']);
                break;
            }
          } catch {
            /* ignore malformed */
          }
        });

        source.addEventListener('error', () => {
          patchState(store, {
            lastEvent: 'Error',
          });
          obj.retryConnection();
        });

        patchState(store, {
          source,
        });
      },
    };
    return obj;
  }),
  withMethods((store) => {
    const guildService = inject(GuildService);

    const obj = {
      toggleSubcommand: rxMethod<{
        commandId: number;
        subcommandName: string;
      }>(
        pipe(
          switchMap(({ commandId, subcommandName }) =>
            guildService.updateSubcommandConfig(
              store.guildId()!,
              commandId,
              subcommandName,
              {
                enabled: !store.commands().get(commandId)?.subcommands?.[
                  subcommandName
                ]?.enabled,
              }
            )
          ),
          tapResponse({
            next: () => {
              // Subcommand updated successfully
            },
            error: (error) => {
              console.error('Error toggling subcommand', error);
            },
          })
        )
      ),
      toggleCommand: rxMethod<{
        commandId: number;
      }>(
        pipe(
          switchMap(({ commandId }) =>
            guildService.updateCommandConfig(store.guildId()!, commandId, {
              enabled: !store.commands().get(commandId)?.enabled,
            })
          ),
          tapResponse({
            next: () => {
              // Command updated successfully
            },
            error: (error) => {
              console.error('Error toggling command', error);
            },
          })
        )
      ),
      saveCommandConfig: rxMethod<{
        commandId: number;
        updates: Partial<CommandConfig>;
      }>(
        pipe(
          switchMap(({ commandId, updates }) =>
            guildService.updateCommandConfig(
              store.guildId()!,
              commandId,
              updates
            )
          ),
          tapResponse({
            next: () => {
              // Command config saved successfully
            },
            error: (error) => {
              console.error('Error saving command config', error);
            },
          })
        )
      ),
      refreshGuildInfo: rxMethod<void>(
        pipe(
          switchMap(() => guildService.getGuildInfo(store.guildId()!)),
          tapResponse({
            next: (guildInfo) => {
              patchState(store, { guildInfo: guildInfo || null });
            },
            error: (error) => {
              console.error('Error refreshing guild info', error);
            },
          })
        )
      ),
    };
    return obj;
  }),
  withComputed((store) => {
    return {
      commandsCategories: computed(() => {
        return Array.from(store.commands().values()).reduce((acc, command) => {
          // Check if command has category information
          if (command.category && command.categoryId) {
            let data = acc.get(command.categoryId) ?? command.category;
            data.commands ??= [];
            const existingCommand = data.commands.find(
              (c) => c.id === command.id
            );
            if (!existingCommand) {
              data.commands.push(command);
            } else {
              data.commands = data.commands.map((c) =>
                c.id === command.id ? command : c
              );
            }
            acc.set(command.categoryId, data);
          }
          return acc;
        }, new Map<number, CommandCategory>());
      }),
    };
  }),
  withHooks((store) => {
    const params = injectParams();
    const guildId = params()['serverId'];
    return {
      onInit: () => {
        patchState(store, {
          guildId,
        });
        store.createSource();
      },
      onDestroy: () => {
        store.source()?.close();
      },
    };
  })
);
