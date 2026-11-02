import { useState } from 'react'
import { Crown, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, Spinner, cx } from '@/components/ui'
import { useMe } from '@/features/auth/AuthProvider'
import { formatShort } from '@/lib/format'
import { friendly, useMembers, useRename, useSetMemberRole } from '@/lib/queries'
import type { Member } from '@/lib/types'

export function MembersPage() {
  const me = useMe()
  const members = useMembers()
  if (members.isPending) return <div className="grid place-items-center py-24"><Spinner /></div>
  if (members.isError) return <p className="text-red-400">{friendly(members.error)}</p>

  const active = members.data.filter((m) => m.active)
  const inactive = members.data.filter((m) => !m.active)

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-stone-50">Miembros</h1>
      <p className="mt-1 text-stone-400">
        {active.length} en el club. Para sumar a alguien, pásale el link: entra con su cuenta de Google y queda adentro.
      </p>

      <RenameForm me={me} />

      <ul className="mt-6 divide-y divide-stone-900 rounded-2xl ring-1 ring-stone-800">
        {active.map((m) => <MemberRow key={m.id} member={m} canManage={me.is_organizer && m.id !== me.id} isMe={m.id === me.id} />)}
      </ul>

      {me.is_organizer && inactive.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-stone-500">Fuera del club</h2>
          <ul className="mt-3 divide-y divide-stone-900 rounded-2xl ring-1 ring-stone-800">
            {inactive.map((m) => <MemberRow key={m.id} member={m} canManage isMe={false} />)}
          </ul>
        </>
      )}
    </div>
  )
}

function MemberRow({ member, canManage, isMe }: { member: Member; canManage: boolean; isMe: boolean }) {
  const setRole = useSetMemberRole()
  const change = (patch: Partial<Pick<Member, 'is_organizer' | 'active'>>, done: string) =>
    setRole.mutate(
      { id: member.id, is_organizer: member.is_organizer, active: member.active, ...patch },
      { onSuccess: () => toast.success(done), onError: (e) => toast.error(friendly(e)) },
    )
  const name = member.display_name

  return (
    <li className={cx('flex flex-wrap items-center gap-3 px-4 py-3', !member.active && 'opacity-60')}>
      <Avatar member={member} size="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-100">
          {name} {isMe && <span className="text-sm font-normal text-stone-500">(tú)</span>}
        </p>
        <p className="text-xs text-stone-500">
          {member.is_organizer && (
            <span className="mr-2 inline-flex items-center gap-1 text-amber-300"><Crown className="h-3 w-3" /> Organizador</span>
          )}
          Desde el {formatShort(member.created_at)}
        </p>
      </div>
      {canManage && (
        <div className="flex gap-1">
          {member.active && (
            <Button
              variant="ghost"
              busy={setRole.isPending}
              onClick={() => change({ is_organizer: !member.is_organizer }, member.is_organizer ? `${name} ya no es organizador` : `${name} ahora es organizador`)}
            >
              <Crown className="h-4 w-4" /> {member.is_organizer ? 'Quitar organizador' : 'Hacer organizador'}
            </Button>
          )}
          {member.active ? (
            <Button
              variant="danger"
              busy={setRole.isPending}
              onClick={() => confirm(`¿Sacar a ${name} del club? Ya no podrá ver ni votar.`) && change({ active: false, is_organizer: false }, `${name} salió del club`)}
            >
              <UserMinus className="h-4 w-4" /> Sacar
            </Button>
          ) : (
            <Button variant="ghost" busy={setRole.isPending} onClick={() => change({ active: true }, `${name} volvió al club`)}>
              <UserPlus className="h-4 w-4" /> Readmitir
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function RenameForm({ me }: { me: Member }) {
  const [name, setName] = useState(me.display_name)
  const rename = useRename()
  const changed = name.trim() && name.trim() !== me.display_name
  return (
    <form
      className="mt-6 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed) rename.mutate({ id: me.id, name }, { onSuccess: () => toast.success('Nombre actualizado'), onError: (err) => toast.error(friendly(err)) })
      }}
    >
      <label className="min-w-0 flex-1 text-sm font-medium text-stone-300">
        Cómo te ven los demás
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="mt-1.5 w-full rounded-xl bg-stone-950 px-3 py-2.5 text-stone-100 ring-1 ring-stone-700 outline-none focus:ring-amber-400"
        />
      </label>
      <Button type="submit" busy={rename.isPending} disabled={!changed}>Guardar</Button>
    </form>
  )
}
