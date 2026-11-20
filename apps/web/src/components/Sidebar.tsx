// Single responsibility: Sidebar navigation showing model picker, chat history grouped by date/pinned, and CRUD actions.

import { useState, useEffect } from 'react';
import {
  MessageSquarePlus,
  Sparkles,
  Settings,
  RefreshCw,
  MessageSquare,
  Pin,
  PinOff,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
} from 'lucide-react';
import type { OllamaModel } from '../types';
import type { ConnectionStatus } from '../hooks/useConnection';
import type { ChatSummary } from '../lib/api';
import type { ProviderPublic } from '../types/providers';
import { ModelPicker } from './ModelPicker';
import { ConfirmDialog } from './ConfirmDialog';

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'checking'
        ? 'bg-amber-500 animate-pulse'
        : 'bg-red-500';
  const label =
    status === 'online' ? 'Online' : status === 'checking' ? 'Checking…' : 'Offline';
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

/**
 * Group chats into pinned list and date-bucketed groups (Today / Yesterday / Previous 7 Days / Older).
 */
function groupChats(chats: ChatSummary[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const sevenDaysAgo = startOfToday - 7 * 86_400_000;

  const groups: Record<string, ChatSummary[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  const pinned: ChatSummary[] = [];

  for (const c of chats) {
    if (c.pinned) {
      pinned.push(c);
      continue;
    }
    const t = c.updatedAt ? new Date(c.updatedAt).getTime() : startOfToday;
    if (t >= startOfToday) groups.Today.push(c);
    else if (t >= startOfYesterday) groups.Yesterday.push(c);
    else if (t >= sevenDaysAgo) groups['Previous 7 Days'].push(c);
    else groups.Older.push(c);
  }

  return {
    pinned,
    groups: Object.entries(groups).filter(([, list]) => list.length > 0),
  };
}

interface ChatRowProps {
  chat: ChatSummary;
  active: boolean;
  onSelectChat: (id: number) => void;
  hasActions: boolean;
  isMenuOpen: boolean;
  isRenaming: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onStartRename: () => void;
  onStopRename: () => void;
  onRename?: (id: number, title: string) => void;
  onPin?: (id: number, pinned: boolean) => void;
  canDelete: boolean;
  onConfirmDelete: () => void;
  onExportChat?: (id: number, format: 'md' | 'json') => void;
}

/**
 * Single chat row in sidebar with kebab actions menu and inline rename input.
 */
function ChatRow({
  chat,
  active,
  onSelectChat,
  hasActions,
  isMenuOpen,
  isRenaming,
  onToggleMenu,
  onCloseMenu,
  onStartRename,
  onStopRename,
  onRename,
  onPin,
  canDelete,
  onConfirmDelete,
  onExportChat,
}: ChatRowProps) {
  return (
    <li className="relative group">
      <div
        className={[
          'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
          active
            ? 'bg-gray-200 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/70',
        ].join(' ')}
      >
        {chat.pinned ? (
          <Pin size={13} className="shrink-0 fill-current opacity-60" />
        ) : (
          <MessageSquare
            size={15}
            className="shrink-0 opacity-60 group-hover:opacity-100"
          />
        )}

        {isRenaming ? (
          <input
            type="text"
            autoFocus
            maxLength={120}
            defaultValue={chat.title}
            aria-label="Rename chat"
            className="w-full rounded bg-white px-1.5 py-0.5 text-xs text-gray-900 outline-none ring-1 ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                const val = e.currentTarget.value.trim();
                if (val && val !== chat.title) {
                  onRename?.(chat.id, val);
                }
                onStopRename();
              } else if (e.key === 'Escape') {
                onStopRename();
              }
            }}
            onBlur={(e) => {
              const val = e.currentTarget.value.trim();
              if (val && val !== chat.title) {
                onRename?.(chat.id, val);
              }
              onStopRename();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelectChat(chat.id)}
            className="min-w-0 flex-1 truncate text-left focus:outline-none"
            title={chat.title}
          >
            <span className="truncate">{chat.title || 'Untitled chat'}</span>
          </button>
        )}

        {hasActions && !isRenaming && (
          <button
            type="button"
            aria-label="Chat actions"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            className={[
              'rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-opacity',
              isMenuOpen
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            ].join(' ')}
          >
            <MoreVertical size={14} />
          </button>
        )}
      </div>

      {/* Popover action menu */}
      {isMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          {onRename && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCloseMenu();
                onStartRename();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Pencil size={13} /> Rename
            </button>
          )}
          {onPin && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCloseMenu();
                onPin(chat.id, !chat.pinned);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {chat.pinned ? <PinOff size={13} /> : <Pin size={13} />}
              {chat.pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {onExportChat && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCloseMenu();
                  onExportChat(chat.id, 'md');
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Download size={13} /> Export Markdown
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCloseMenu();
                  onExportChat(chat.id, 'json');
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Download size={13} /> Export JSON
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCloseMenu();
                onConfirmDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export interface SidebarProps {
  models: OllamaModel[];
  model: string;
  onModelChange: (providerId: string, model: string) => void;
  onNewChat: () => void;
  baseUrl: string;
  status: ConnectionStatus;
  loadingModels: boolean;
  onOpenSettings: () => void;
  onRetry: () => void;
  chats: ChatSummary[];
  activeChatId?: number;
  onSelectChat: (id: number) => void;
  providers?: ProviderPublic[];
  currentProviderId?: string;
  onRename?: (id: number, title: string) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onDeleteChat?: (id: number) => void;
  onExportChat?: (id: number, format: 'md' | 'json') => void;
  /** Test-only: initial inline rename state. Defaults to undefined. */
  initialRenamingId?: number;
}

export function Sidebar({
  models,
  model,
  onModelChange,
  onNewChat,
  baseUrl,
  status,
  loadingModels,
  onOpenSettings,
  onRetry,
  chats,
  activeChatId,
  onSelectChat,
  providers = [],
  currentProviderId,
  onRename,
  onPin,
  onDeleteChat,
  onExportChat,
  initialRenamingId,
}: SidebarProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(initialRenamingId ?? null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const hasActions = Boolean(onRename || onPin || onDeleteChat || onExportChat);
  const grouped = groupChats(chats);
  const confirmChat = confirmId !== null ? chats.find((c) => c.id === confirmId) : null;

  useEffect(() => {
    if (openMenuId === null) return;
    const handleClickOutside = () => setOpenMenuId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [openMenuId]);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950 md:flex">
      {/* Header — neutral badge matching EmptyState */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            Beacon Flux
          </p>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
            Local · private
          </p>
        </div>
      </div>

      {/* New chat */}
      <div className="px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="
            flex w-full items-center gap-2.5 rounded-lg border border-gray-200
            bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm
            transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow
            dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100
            dark:hover:border-gray-600 dark:hover:bg-gray-800/60
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-gray-900/20 dark:focus-visible:ring-gray-100/20
          "
        >
          <MessageSquarePlus size={17} />
          New chat
        </button>
      </div>

      {/* Model selector */}
      <div className="mt-4 px-3">
        <ModelPicker
          providers={providers}
          currentProviderId={currentProviderId}
          currentModel={model}
          ollamaModels={models}
          onSelect={onModelChange}
        />
      </div>

      {/* Chat history — ChatGPT style */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {chats.length === 0 && (
            <div className="px-2 py-6 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                No chats yet.
              </p>
              <p className="mt-1 text-[11px] text-gray-400/80 dark:text-gray-500/80">
                Start a conversation to save it here.
              </p>
            </div>
          )}

          {/* Pinned section */}
          {grouped.pinned.length > 0 && (
            <div className="mb-2">
              <h3 className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Pinned
              </h3>
              <ul className="space-y-0.5">
                {grouped.pinned.map((c) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    active={c.id === activeChatId}
                    onSelectChat={onSelectChat}
                    hasActions={hasActions}
                    isMenuOpen={openMenuId === c.id}
                    isRenaming={renamingId === c.id}
                    onToggleMenu={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                    onCloseMenu={() => setOpenMenuId(null)}
                    onStartRename={() => setRenamingId(c.id)}
                    onStopRename={() => setRenamingId(null)}
                    onRename={onRename}
                    onPin={onPin}
                    canDelete={Boolean(onDeleteChat)}
                    onConfirmDelete={() => setConfirmId(c.id)}
                    onExportChat={onExportChat}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Date groups */}
          {grouped.groups.map(([label, list]) => (
            <div key={label} className="mb-2">
              <h3 className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
              </h3>
              <ul className="space-y-0.5">
                {list.map((c) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    active={c.id === activeChatId}
                    onSelectChat={onSelectChat}
                    hasActions={hasActions}
                    isMenuOpen={openMenuId === c.id}
                    isRenaming={renamingId === c.id}
                    onToggleMenu={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                    onCloseMenu={() => setOpenMenuId(null)}
                    onStartRename={() => setRenamingId(c.id)}
                    onStopRename={() => setRenamingId(null)}
                    onRename={onRename}
                    onPin={onPin}
                    canDelete={Boolean(onDeleteChat)}
                    onConfirmDelete={() => setConfirmId(c.id)}
                    onExportChat={onExportChat}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Connection footer */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-800">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Connection
            </span>
            <StatusDot status={status} />
          </div>
          <p
            className="truncate font-mono text-[11px] text-gray-600 dark:text-gray-300"
            title={baseUrl}
          >
            {baseUrl.replace(/^https?:\/\//, '')}
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="
                flex flex-1 items-center justify-center gap-1 rounded-md
                border border-gray-200 px-2 py-1.5 text-[11px] font-medium
                text-gray-700 transition-colors hover:bg-gray-50
                dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-gray-900/20 dark:focus-visible:ring-gray-100/20
              "
            >
              <Settings size={12} /> Change
            </button>
            <button
              type="button"
              onClick={onRetry}
              title="Re-check connection"
              className="
                grid place-items-center rounded-md border border-gray-200
                px-2 py-1.5 text-gray-700 transition-colors hover:bg-gray-50
                dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-gray-900/20 dark:focus-visible:ring-gray-100/20
              "
            >
              <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
          Chats saved to your local Postgres database.
        </p>
      </div>

      {/* Delete confirmation dialog */}
      {confirmChat && (
        <ConfirmDialog
          open={true}
          title="Delete chat?"
          message={`"${confirmChat.title || 'Untitled chat'}" and its messages will be permanently removed.`}
          danger={true}
          onConfirm={() => {
            if (confirmId !== null) {
              onDeleteChat?.(confirmId);
            }
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </aside>
  );
}
