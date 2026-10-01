// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// The firm's statement library: letterhead, accountant's report letters,
// style presets and portable layout templates. One library for the whole
// installation; everyone can read it, administrators edit it.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FS_BUILTIN_STYLES, type FsLetterheadInput, type FsStyle } from '../../lib/fsEngine';
import { fsApi, fsErrorMessage, type FsLibrary, type FsLibraryLetter, type FsLibraryPreset, type FsLibraryTemplate } from '../../api/fs';
import { useAuthStore, pushToast } from '../../store/uiStore';
import { confirmAction } from '../../components/ConfirmDialog';
import { RefreshButton } from '../../components/RefreshButton';
import { RichTextEditor } from '../../components/RichTextEditor';
import { Spinner } from '../../components/Spinner';
import { LETTER_VARS, StylePanel } from './FsPanels';
import { Btn, ErrorBox, Field, inputCls } from './ui';

type Tab = 'letterhead' | 'letters' | 'styles' | 'templates';

function useLibraryMutation<A>(fn: (a: A) => Promise<unknown>, done: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['fs-library'] }); pushToast(done, 'success'); },
    onError: (e) => pushToast(fsErrorMessage(e, 'Save failed'), 'error'),
  });
}

export function FsLibraryPage() {
  const q = useQuery({ queryKey: ['fs-library'], queryFn: fsApi.library });
  const canEdit = useAuthStore((s) => s.user?.role) === 'admin';
  const [tab, setTab] = useState<Tab>('letterhead');
  const tabs: Array<[Tab, string]> = [['letterhead', 'Letterhead'], ['letters', "Accountant's reports"], ['styles', 'Styles'], ['templates', 'Layout templates']];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/statement-writer" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">← Statement Writer</Link>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-2">Statement Library<RefreshButton /></h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Used by every set of financial statements this firm prepares.{!canEdit && ' Only administrators can change it.'}
      </p>
      <div className="mt-4 flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-medium ${tab === k ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-4">
        {q.isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : q.isError || !q.data ? (
          <ErrorBox>{fsErrorMessage(q.error, 'Could not load the library.')} <button className="underline" onClick={() => q.refetch()}>Retry</button></ErrorBox>
        ) : tab === 'letterhead' ? <LetterheadTab lh={q.data.letterhead} canEdit={canEdit} />
          : tab === 'letters' ? <LettersTab letters={q.data.letters} canEdit={canEdit} />
            : tab === 'styles' ? <StylesTab presets={q.data.presets} canEdit={canEdit} />
              : <TemplatesTab templates={q.data.templates} canEdit={canEdit} />}
      </div>
    </div>
  );
}

function LetterheadTab({ lh, canEdit }: { lh: FsLibrary['letterhead']; canEdit: boolean }) {
  const save = useLibraryMutation((f: FsLetterheadInput) => fsApi.saveLetterhead(f), 'Letterhead saved');
  const [form, setForm] = useState<FsLetterheadInput>({});
  useEffect(() => {
    setForm({
      displayName: lh.displayName ?? '', addressLine1: lh.addressLine1 ?? '', addressLine2: lh.addressLine2 ?? '', city: lh.city ?? '',
      state: lh.state ?? '', postalCode: lh.postalCode ?? '', phone: lh.phone ?? '', email: lh.email ?? '', website: lh.website ?? '',
      logoDataUri: lh.logoDataUri ?? null, accountantSignature: lh.accountantSignature ?? '', letterheadAlign: lh.letterheadAlign ?? 'left',
      letterheadContent: lh.letterheadContent ?? 'both', logoSize: lh.logoSize ?? 'small',
    });
  }, [lh]);
  const set = (k: keyof FsLetterheadInput, v: string | null) => setForm((f) => ({ ...f, [k]: v }));
  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { pushToast('The logo must be a PNG or JPEG', 'error'); return; }
    if (file.size > 700 * 1024) { pushToast('The logo must be 700 KB or smaller', 'error'); return; }
    const r = new FileReader();
    r.onload = () => set('logoDataUri', String(r.result));
    r.readAsDataURL(file);
  };
  const text = (k: keyof FsLetterheadInput, label: string) => (
    <Field label={label}><input className={inputCls} value={(form[k] as string | null | undefined) ?? ''} onChange={(e) => set(k, e.target.value)} /></Field>
  );
  return (
    <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        {text('displayName', 'Firm name')}
        {text('addressLine1', 'Address')}
        {text('addressLine2', 'Address line 2')}
        <div className="grid grid-cols-3 gap-2">{text('city', 'City')}{text('state', 'State')}{text('postalCode', 'ZIP')}</div>
        <div className="grid grid-cols-2 gap-2">{text('phone', 'Phone')}{text('email', 'Email')}</div>
        {text('website', 'Website')}
        {text('accountantSignature', "Signature line (e.g. 'Smith & Co., CPAs')")}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Letterhead shows">
            <select className={inputCls} value={form.letterheadContent ?? 'both'} onChange={(e) => set('letterheadContent', e.target.value)}>
              <option value="both">Logo and firm name / address</option>
              <option value="logo">Logo only</option>
              <option value="text">Firm name / address only</option>
            </select>
          </Field>
          <Field label="Alignment">
            <select className={inputCls} value={form.letterheadAlign ?? 'left'} onChange={(e) => set('letterheadAlign', e.target.value)}>
              <option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option>
            </select>
          </Field>
        </div>
        <Field label="Logo size">
          <select className={inputCls} value={form.logoSize ?? 'small'} disabled={!canEdit || (form.letterheadContent ?? 'both') === 'text'} onChange={(e) => set('logoSize', e.target.value)}>
            <option value="small">Small (up to 0.9 in tall)</option>
            <option value="medium">Medium (up to 1.5 in tall)</option>
            <option value="content_width">Full width, inside the page margins</option>
            <option value="full_bleed">Edge to edge — top and sides of the page (banner)</option>
          </select>
        </Field>
        <div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Logo (PNG or JPEG, up to 700 KB)</span>
          <div className="mt-1 flex items-center gap-3">
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} className="text-sm text-gray-700 dark:text-gray-300" aria-label="Logo file" />
            {form.logoDataUri && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => set('logoDataUri', null)}>Remove</button>}
          </div>
        </div>
        {canEdit && <Btn busy={save.isPending} onClick={() => save.mutate(form)}>Save letterhead</Btn>}
      </div>
      <LetterheadPreview form={form} />
    </fieldset>
  );
}

// A scaled page (1 in = 40 px) showing the letterhead as it prints on the
// accountant's report, with 1-inch margins. Always white: it is paper.
function LetterheadPreview({ form }: { form: FsLetterheadInput }) {
  const IN = 40;
  const content = form.letterheadContent ?? 'both';
  const size = form.logoSize ?? 'small';
  const align = form.letterheadAlign ?? 'left';
  const logo = form.logoDataUri && content !== 'text' ? form.logoDataUri : null;
  const showText = content !== 'logo' || !form.logoDataUri;
  const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  const logoPos = align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : '';
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Preview — accountant&apos;s report page</p>
      <div className="relative mx-auto bg-white shadow border border-gray-200 overflow-hidden" style={{ width: 8.5 * IN, height: 11 * IN, padding: IN }}>
        <div className={alignCls}>
          {logo && size === 'full_bleed' && (
            <img src={logo} alt="" style={{ display: 'block', width: 8.5 * IN, maxWidth: 'none', margin: `${-IN}px ${-IN}px 0 ${-IN}px` }} />
          )}
          {logo && size === 'content_width' && <img src={logo} alt="" className="block w-full mb-1.5" />}
          {logo && (size === 'small' || size === 'medium') && (
            <img src={logo} alt="" className={`block max-w-full mb-1.5 ${logoPos}`} style={{ maxHeight: (size === 'medium' ? 1.5 : 0.9) * IN }} />
          )}
          {showText && (
            <div className={size === 'full_bleed' && logo ? 'mt-2' : ''}>
              <div className="font-bold text-gray-900 text-[11px]">{form.displayName || 'Your firm name'}</div>
              <div className="text-[8px] text-gray-600 leading-tight">
                {[form.addressLine1, form.addressLine2, [form.city, [form.state, form.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
                <div>{[form.phone, form.email, form.website].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 text-center text-[10px] font-bold text-gray-800">Accountant&apos;s Compilation Report</div>
        <div className="mt-2 space-y-1.5">
          {[100, 96, 98, 60, 0, 100, 94, 97, 72].map((w, i) => <div key={i} className="h-1 rounded bg-gray-200" style={{ width: `${w}%`, opacity: w ? 1 : 0 }} />)}
        </div>
      </div>
    </div>
  );
}

const listBtn = (on: boolean) => `block w-full text-left rounded-md px-3 py-2 text-sm ${on ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`;
const star = <span className="text-amber-500 mr-1" title="Default" aria-label="Default">★</span>;

function LettersTab({ letters, canEdit }: { letters: FsLibraryLetter[]; canEdit: boolean }) {
  const save = useLibraryMutation(fsApi.saveLetter, 'Report template saved');
  const del = useLibraryMutation((id: number) => fsApi.deleteLetter(id), 'Removed from the library');
  const [selected, setSelected] = useState<number | 'new' | null>(letters[0]?.id ?? null);
  const current = selected === 'new' ? null : letters.find((l) => l.id === selected) ?? null;
  const [form, setForm] = useState({ name: '', letterType: 'compilation' as 'compilation' | 'preparation', title: '', bodyHtml: '', isDefault: false });
  useEffect(() => {
    if (selected === 'new') setForm({ name: 'New report', letterType: 'compilation', title: '', bodyHtml: '<p></p>', isDefault: false });
    else if (current) setForm({ name: current.name, letterType: current.letterType, title: current.title ?? '', bodyHtml: current.bodyHtml, isDefault: current.isDefault });
    // Re-seed only when a different letter is picked, not on every refetch of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current?.id, current?.updatedAt]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      <div className="space-y-1">
        {letters.map((l) => (
          <button key={l.id} onClick={() => setSelected(l.id)} className={listBtn(selected === l.id)}>
            {l.isDefault && star}{l.name}
            <span className="block text-xs text-gray-500 dark:text-gray-400">{l.letterType === 'compilation' ? 'Compilation (AR-C 80)' : 'Preparation (AR-C 70)'}</span>
          </button>
        ))}
        {canEdit && <Btn small variant="secondary" className="w-full" onClick={() => setSelected('new')}>New report template</Btn>}
      </div>
      {selected !== null && (current || selected === 'new') && (
        <fieldset disabled={!canEdit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Engagement">
              <select className={inputCls} value={form.letterType} onChange={(e) => setForm({ ...form, letterType: e.target.value as 'compilation' | 'preparation' })}>
                <option value="compilation">Compilation (AR-C 80)</option><option value="preparation">Preparation (AR-C 70)</option>
              </select>
            </Field>
          </div>
          <Field label="Printed title" hint="Blank = the standard title for the engagement">
            <input className={inputCls} placeholder={form.letterType === 'compilation' ? "Accountant's Compilation Report" : 'Preparation of Financial Statements'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          {canEdit
            ? <RichTextEditor key={String(selected)} value={form.bodyHtml} onChange={(bodyHtml) => setForm((f) => ({ ...f, bodyHtml }))} variables={LETTER_VARS} ariaLabel="Report wording" />
            // Shown, not editable. The stored HTML was sanitized by the server on save.
            : <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white text-gray-900 px-4 py-3 text-sm leading-relaxed [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: form.bodyHtml }} />}
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            <code>{'{{variables}}'}</code> are filled in for each statement set — the client&apos;s name, the period, the basis, the statements actually included.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />Default for new statements</label>
          {canEdit && (
            <div className="flex gap-2">
              <Btn busy={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate(
                { ...(current ? { id: current.id } : {}), name: form.name.trim(), letterType: form.letterType, title: form.title.trim() || null, bodyHtml: form.bodyHtml, isDefault: form.isDefault, isActive: true },
                { onSuccess: (r) => { const id = (r as { letter?: { id: number } }).letter?.id; if (id) setSelected(id); } },
              )}>Save</Btn>
              {current && (
                <Btn variant="ghost" onClick={async () => {
                  if (await confirmAction({ title: 'Remove this report?', message: `"${current.name}" will no longer be offered. Statement sets already using it fall back to the default report.`, confirmLabel: 'Remove', tone: 'danger' })) {
                    del.mutate(current.id, { onSuccess: () => setSelected(null) });
                  }
                }}>Remove</Btn>
              )}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

function StylesTab({ presets, canEdit }: { presets: FsLibraryPreset[]; canEdit: boolean }) {
  const save = useLibraryMutation(fsApi.savePreset, 'Style saved');
  const del = useLibraryMutation((id: number) => fsApi.deletePreset(id), 'Style deleted');
  const [selected, setSelected] = useState<number | null>(presets[0]?.id ?? null);
  const current = presets.find((p) => p.id === selected) ?? null;
  const [name, setName] = useState('');
  const [style, setStyle] = useState<FsStyle | null>(null);
  useEffect(() => {
    if (current) { setName(current.name); setStyle(current.style); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.updatedAt]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      <div className="space-y-1">
        {presets.map((p) => (
          <button key={p.id} onClick={() => setSelected(p.id)} className={listBtn(selected === p.id)}>
            {p.isDefault && star}{p.name}{p.builtin ? <span className="ml-1 text-xs text-gray-400">built-in</span> : null}
          </button>
        ))}
        {canEdit && (
          <Btn small variant="secondary" className="w-full" busy={save.isPending}
            onClick={() => save.mutate({ name: 'New style', style: FS_BUILTIN_STYLES[0]!.style }, { onSuccess: (r) => { const id = (r as { preset?: { id: number } }).preset?.id; if (id) setSelected(id); } })}>New style</Btn>
        )}
      </div>
      {current && style && (
        <div className="space-y-3 max-w-xl">
          <Field label="Name"><input disabled={!canEdit} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <StylePanel style={style} onChange={setStyle} readOnly={!canEdit} />
          {canEdit && (
            <div className="flex gap-2">
              <Btn busy={save.isPending} disabled={!name.trim()} onClick={() => save.mutate({ id: current.id, name: name.trim(), style })}>Save</Btn>
              {!current.isDefault && <Btn variant="secondary" onClick={() => save.mutate({ id: current.id, name: name.trim() || current.name, style, isDefault: true })}>Make default</Btn>}
              {!current.builtin && (
                <Btn variant="ghost" onClick={async () => {
                  if (await confirmAction({ title: 'Delete this style?', message: `"${current.name}" will be removed from the library. Statements already using it keep their own copy.`, confirmLabel: 'Delete', tone: 'danger' })) {
                    del.mutate(current.id, { onSuccess: () => setSelected(null) });
                  }
                }}>Delete</Btn>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplatesTab({ templates, canEdit }: { templates: FsLibraryTemplate[]; canEdit: boolean }) {
  const rename = useLibraryMutation((a: { id: number; name: string }) => fsApi.updateTemplate(a.id, { name: a.name }), 'Renamed');
  const del = useLibraryMutation((id: number) => fsApi.deleteTemplate(id), 'Template deleted');
  if (!templates.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No firm templates yet. Build a layout for one client, then use &ldquo;Save this layout as a firm template&rdquo; in the statement editor to
        reuse it for other clients. A template keeps the outline and its lead sheet letters — never a client&apos;s own accounts.
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-gray-500 dark:text-gray-400"><tr><th className="py-2 font-medium">Name</th><th className="py-2 font-medium">Entity type</th><th className="py-2 font-medium" /></tr></thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {templates.map((t) => (
          <tr key={t.id}>
            <td className="py-2">
              <input disabled={!canEdit} aria-label="Template name" className="rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm py-0.5 px-1" defaultValue={t.name}
                onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== t.name) rename.mutate({ id: t.id, name: n }); }} />
              {t.description && <div className="px-1 text-xs text-gray-500 dark:text-gray-400">{t.description}</div>}
            </td>
            <td className="py-2 text-gray-600 dark:text-gray-300 capitalize">{t.entityKind === 'any' ? 'Any' : t.entityKind.replace('_', ' ')}</td>
            <td className="py-2 text-right">
              {canEdit && (
                <button className="px-2 text-xs text-red-600 hover:underline" onClick={async () => {
                  if (await confirmAction({ title: 'Delete this template?', message: `"${t.name}" will be removed. Layouts already made from it are copies and keep working.`, confirmLabel: 'Delete', tone: 'danger' })) del.mutate(t.id);
                }}>Delete</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
