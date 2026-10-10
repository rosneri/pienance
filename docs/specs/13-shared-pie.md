# Shared pie

Status: proposed · Depends on: Put back and move (who may put back what)

## Why

Couples and housemates spend from one household budget. Two separate pies hide the shared
picture, and one shared login loses who ate what.

## Language

| Term       | Meaning                                                        |
| ---------- | -------------------------------------------------------------- |
| **Baker**  | The person who baked the pie. Can re-slice and invite.         |
| **Guest**  | A person invited to a pie. Can weigh, take and see every bite. |
| **Invite** | A single-use link that makes the person who opens it a guest.  |

## Behaviour

- The baker creates an invite link, valid for seven days and one use. Creating a new one
  cancels the open one.
- Opening it signed in adds the person as a guest. Signed out, it goes through sign-up or
  sign-in first and comes back.
- A person belongs to at most one pie. Accepting an invite while in a pie is refused with
  "You already have a pie." Merging pies is out of scope. A guest cannot bake.
- Every bite records who took it. The bite list shows their initial; pills above it filter by
  person.
- Who may do what:
  - Everyone: weigh, take, stock and drop staples, take and weigh spreads, `find_room`.
  - Own bites only, for guests: put back, move, put back a spread.
  - Baker only: re-slice, carry over and undo, set the sweep, invite, cancel an invite, remove
    a guest. The baker can put back or move any bite.
- The baker can remove a guest. Their past bites stay, credited to them. The removed person
  has no pie afterwards and can bake their own.
- Sentences stay about the pie, not the people: "About half of your pie is left."
- Interactions: the shelf (06) and appetite (08) are the pie's, seen alike by everyone.

## Design

### Core

- `Pie` gains `members: readonly Member[]` with `Member { userId, role: "baker" | "guest" }`.
  `ownerId` stays as the baker's id for compatibility; `Pie.roleOf(userId)` throws `PieError`
  for a non-member.
- `Bite` gains `takenBy: string` (a user id).
- Use case inputs keep the field `ownerId`, which now means the signed-in member. Each use
  case checks the role with `Pie.roleOf`; the rules above are the only ones. The session still
  never reaches core.
- `PieRepository.find(memberId, month)` finds the pie by membership. `save` writes members.
- Use cases `invite(ports)({ ownerId })` returning `{ token, expiresAt }`,
  `cancelInvite(ports)({ ownerId })`, `acceptInvite(ports)({ userId, token })`,
  `removeGuest(ports)({ ownerId, guestId })`.
- `PieRepository` gains `openInvite(pieId)`, `saveInvite(invite)`, `findInvite(token)`, each
  on a small `Invite { token, pieId, expiresAt, usedAt? }` value. Invites are not part of the
  `Pie` aggregate: a token is checked and used once, on its own.
- `Ports.newToken: () => string` for unguessable invite tokens, supplied by the web composition
  root (`crypto.randomUUID()` is enough).
- Display names are not in core. Views carry `takenBy` ids; the web app maps ids to names.

### Persistence

```prisma
model PieMember {
  pieId  String
  userId String
  role   String
  pie    Pie    @relation(fields: [pieId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([pieId, userId])
  @@unique([userId])
}

model Invite {
  token     String    @id
  pieId     String
  pie       Pie       @relation(fields: [pieId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  usedAt    DateTime?

  @@index([pieId])
}
```

- `Bite.takenBy String`, backfilled with the pie's `ownerId` in the migration.
- The migration creates a `baker` member for each owner's newest pie only. Older pies of the
  same owner (baked again) are already hidden and get no member, or `@@unique([userId])`
  would fail.
- `find` by membership: `pieMember.findUnique({ where: { userId } })`, then the pie.

### Web

- `/invite/[token]` page: accept, or sign up or sign in first with `next` back to it.
- `/share` page for the baker, from the "Share pie" item in the masthead menu.
- Names: a small server helper reads user names by id from the auth tables, outside core, for
  bite badges, the filter pills and the invite page.
- Bite rows show the taker's initial in a `secondary` badge.

### Agent tools

- `read_pie` bites include `takenBy` (display name).
- Tools follow the role rules above; the baker-only tools are not registered for guests.
- No invite tool: sharing access stays a deliberate human action.

### Auth

Better Auth's organization plugin was considered. It brings teams, roles and invitations
designed for workspaces, which is far more than one table of members. A plain table keeps the
domain in pienance's language.

## UX

- **Sharing.** "Share pie" in the masthead menu, for the baker only. It opens `/share`:
  - One line: "Anyone with this link can join this pie. It works once, for seven days."
  - "Share invite link" uses the system share sheet where there is one, otherwise copies the
    link and answers "Link copied."
  - An open invite shows as "One invite open until 17 October", with "Cancel invite".
  - Guests are listed by name, each with "Remove", confirmed inline.
- **Invite page.** It shows no pie data before joining: "Ana invited you to a shared pie."
  with "Join the pie" and "Not now".
  - Expired or used: "This invite has expired. Ask Ana for a new one."
  - Already in a pie: "You already have a pie. Shared pies are one per person for now."
- **Bite rows.** A 24px initial badge before the note, on `secondary`, labelled
  "taken by Ana" for screen readers.
- **Filter.** Pills above the bite list: "Everyone", then each person. They filter the list
  only; the pie always shows the whole household.
- **Guests.** The masthead menu hides Re-slice and Share pie. Guests see "Put back" and
  "Move to…" only on their own bites. The carry offer and sweep settings are not shown.

## Acceptance criteria

- [ ] A guest's re-slice, carry, sweep, invite or removal is refused with `PieError`.
- [ ] A guest can put back or move only bites they took; the baker can do any.
- [ ] Every new bite carries `takenBy`; backfilled bites carry the baker.
- [ ] An invite works once, within seven days; a second use or a late use is refused.
- [ ] Creating an invite cancels the open one.
- [ ] Accepting while in a pie is refused; the person's own pie is untouched.
- [ ] Removing a guest keeps their bites and lets them bake afterwards.
- [ ] `find` by membership returns the shared pie for baker and guest alike.
- [ ] The migration gives each owner's newest pie one baker member and leaves older pies
      without one.
- [ ] Baker-only tools are not registered for a guest.

## Tests

- Unit: role checks for each rule; bites record their taker.
- Integration (Postgres): invite once only, expiry, one pie per person, guest removal keeps
  bites, migration backfill with an owner who baked twice.
- Web: invite page for signed-in, signed-out, used and expired links, through server actions
  with real Postgres users.

## Out of scope

- More than one pie per person.
- Splitting who owes whom.
- Private bites inside a shared pie.
