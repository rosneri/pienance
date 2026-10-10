import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

/** Members use pienance; admins also operate it. Stored on the user (`user.role`). */
export const roles = ["member", "admin"] as const;

export type Role = (typeof roles)[number];

/** Who is asking: the signed-in user's id and role. */
export interface Viewer {
  readonly id: string;
  readonly role: Role;
}

/** What can be done… */
type Action = "read";

/** …to what. Pies are not here: the use cases already scope them to their owner. */
type Subject = "Telemetry";

export type Ability = MongoAbility<[Action, Subject]>;

/** A stored role; anything unknown is treated as the least privileged. */
export function roleOf(value: string | null | undefined): Role {
  return roles.find((role) => role === value) ?? "member";
}

/** What a viewer (or an anonymous visitor, null) may do. Add rules here as roles grow. */
export function abilityFor(viewer: Viewer | null): Ability {
  const { can, build } = new AbilityBuilder<Ability>(createMongoAbility);

  if (viewer?.role === "admin") {
    can("read", "Telemetry");
  }

  return build();
}
