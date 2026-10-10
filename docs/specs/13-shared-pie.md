# Shared pie

Status: proposed · Depends on: Put back and move (who may put back what)

## Why

Couples and housemates spend from one household budget. Two separate pies hide the shared
picture, and one shared login loses who ate what.

## Language

| Term       | Meaning                                                            |
| ---------- | ------------------------------------------------------------------ |
| **Baker**  | The person who baked the pie. Can re-slice and invite.             |
| **Guest**  | A person invited to a pie. Can weigh, take and see every bite.     |
| **Invite** | A single-use link that makes the person who opens it a guest.      |

## Behaviour

- The baker creates an invite link, valid for seven days and one use.
- Opening it signed in adds the person as a guest. Signed out, it goes through sign-up first.
- A person belongs to at most one pie. Accepting an invite while owning a pie is refused with
  "You already have a pie." Merging pies is out of scope.
- Every bite records who took it. The bite list shows their initial; the legend can filter by
  person.
- Guests can put back only their own bites. The baker can put back any.
- The baker can remove a guest. Their past bites stay, credited to them.
- Sentences stay about the pie, not the people: "About half of your pie is left."

## Design

### Core

- `Pie` gains `members: readonly Member[]` with `Member { userId, role: "baker" | "guest" }`.
  `ownerId` stays as the baker for compatibility.
- `Bite` gains `takenBy: string`.
- Use cases receive a `memberId` where they now receive `ownerId`, and check the role for
  re-slice, invite and removal. The session still never reaches core.
- `PieRepository.find(memberId, month)` finds the pie by membership.
- Use cases `invite(ports)({ memberId })` returning a token, `acceptInvite(ports)({ userId,
  token })`, `removeGuest(ports)({ memberId, guestId })`.
- `Ports.newToken` for unguessable invite tokens, supplied by the web composition root.

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
  expiresAt DateTime
  usedAt    DateTime?
}
```

- `Bite.takenBy String`, backfilled with the pie's `ownerId` in the migration.
- A backfill creates a `baker` member for every existing pie.

### Web

- `/invite/[token]` page: accept or sign up first.
- A "Share pie" item in the masthead for the baker, copying the link.
- Bite rows show the taker's initial in a token-coloured badge.

### Agent tools

- `read_pie` bites include `takenBy` names.
- No invite tool: sharing access should stay a deliberate human action.

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
  - Expired: "This invite has expired. Ask Ana for a new one."
  - Already baked: "You already have a pie. Shared pies are one per person for now."
- **Bite rows.** A 24px initial badge before the note, on `secondary`, labelled
  "taken by Ana" for screen readers.
- **Filter.** Pills above the bite list: "Everyone", then each person. They filter the list
  only; the pie always shows the whole household.
- **Guests.** The masthead menu hides Re-slice and Share pie. Guests see "Put back" only on
  their own bites.

## Tests

- Unit: role checks for re-slice and put back; bites record their taker.
- Integration (Postgres): invite once only, expiry, one pie per person, guest removal keeps
  bites, migration backfill.
- Web: invite page for signed-in, signed-out and expired links, through server actions with
  real Postgres users.

## Out of scope

- More than one pie per person.
- Splitting who owes whom.
- Private bites inside a shared pie.
