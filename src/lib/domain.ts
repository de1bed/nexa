export const visitStatuses = ["draft","invited","pre_registered","approved","checked_in","checked_out","denied","cancelled","expired"] as const;
export type VisitStatus = (typeof visitStatuses)[number];
export type MemberRole = "superadmin" | "admin" | "host" | "guard";
export type VisitOrigin = "host_invitation" | "public_link" | "guard_manual";

export type Visit = {
  id: string; visitorName: string; email: string; phone?: string; company: string; hostName: string; hostId: string;
  location: string; startsAt: string; endsAt: string; checkedInAt?: string; checkedOutAt?: string;
  purpose: string; status: VisitStatus; origin: VisitOrigin; notes?: string; vehiclePlate?: string;
  invitationToken?: string; qrToken?: string; documentCaptured: boolean; consentedAt?: string; denialReason?: string;
};
export type AccessEvent = { id: string; visitId: string; type: "qr_scanned"|"check_in"|"check_out"|"denied"|"invitation_created"|"pre_registered"; at: string; actor: string; detail?: string };
export type DemoState = { visits: Visit[]; events: AccessEvent[] };

export const statusLabels: Record<VisitStatus,string> = {
  draft:"Borrador",invited:"Invitada",pre_registered:"Preregistrada",approved:"Aprobada",checked_in:"Dentro",checked_out:"Salida registrada",denied:"Denegada",cancelled:"Cancelada",expired:"Vencida"
};
