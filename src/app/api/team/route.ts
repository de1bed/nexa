import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";

const inviteSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.email(),
  role: z.enum(["admin", "host", "guard"]),
});
export async function GET() {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (
    !context.selected ||
    !["admin", "superadmin"].includes(context.selected.role)
  )
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  const { data, error } = await context.db
    .from("organization_members")
    .select(
      "profile_id,role,active,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
    )
    .eq("organization_id", context.selected.organizationId)
    .order("created_at");
  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar el equipo" },
      { status: 500 },
    );
  return NextResponse.json({
    members: (data ?? []).map((row) => ({
      id: row.profile_id,
      role: row.role,
      active: row.active,
      name:
        (row.profile as unknown as { full_name?: string } | null)?.full_name ??
        "Usuario",
      email: (row.profile as unknown as { email?: string } | null)?.email ?? "",
    })),
  });
}
export async function POST(request: Request) {
  try {
    const input = inviteSchema.parse(await request.json());
    const context = await getSessionContext();
    if (!context.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (
      !context.selected ||
      !["admin", "superadmin"].includes(context.selected.role)
    )
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      input.email,
      {
        data: { full_name: input.fullName },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/update-password`,
      },
    );
    if (error || !data.user)
      return NextResponse.json(
        {
          error:
            "No fue posible invitar; quizá el correo ya pertenece a un usuario",
        },
        { status: 409 },
      );
    await admin.from("profiles").upsert({
      id: data.user.id,
      full_name: input.fullName,
      email: input.email,
    });
    await admin.from("organization_members").upsert(
      {
        organization_id: context.selected.organizationId,
        profile_id: data.user.id,
        role: input.role,
        active: true,
      },
      { onConflict: "organization_id,profile_id" },
    );
    await admin.from("audit_logs").insert({
      organization_id: context.selected.organizationId,
      actor_id: context.user.id,
      event_type: "member_invited",
      metadata: { role: input.role },
    });
    return NextResponse.json(
      {
        member: {
          id: data.user.id,
          name: input.fullName,
          email: input.email,
          role: input.role,
          active: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible invitar" },
      { status: 500 },
    );
  }
}
