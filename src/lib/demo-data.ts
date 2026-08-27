import type { DemoState, Visit, VisitStatus } from "./domain";

const names = ["Sofía Rivera","Diego Luna","Camila Ortega","Andrés Vega","Renata Silva","Javier Campos","Mariana Ríos","Emilio Navarro","Paula Castillo","Nicolás Serrano"];
const companies = ["Arco Studio","Lumen Tech","Órbita Legal","Punto Norte","Atlas Supply"];
const purposes = ["Reunión comercial","Entrega de proveedor","Entrevista","Auditoría","Soporte técnico"];
const statuses: VisitStatus[] = ["invited","pre_registered","approved","checked_in","checked_out","denied"];
const day = (offset:number,hour:number) => { const d=new Date(); d.setHours(hour,0,0,0); d.setDate(d.getDate()+offset); return d.toISOString(); };

export const demoVisits: Visit[] = Array.from({length:25},(_,i)=>{
  const n=i+1,status=statuses[i%statuses.length],hour=8+(i%9),offset=(i%9)-4;
  const checkedInAt=["checked_in","checked_out"].includes(status)?day(offset,hour):undefined;
  return { id:`visit-${n}`,visitorName:names[i%names.length],email:`visitante${n}@example.test`,phone:`664 000 ${String(n).padStart(4,"0")}`,
    company:companies[i%companies.length],hostName:i%2?"Mateo García":"Valeria Cruz",hostId:i%2?"host-mateo":"host-valeria",location:"Centro de Distribución Tijuana",
    startsAt:day(offset,hour),endsAt:day(offset,hour+1),checkedInAt,checkedOutAt:status==="checked_out"?day(offset,hour+1):undefined,
    purpose:purposes[i%purposes.length],status,origin:"host_invitation",invitationToken:n===1?"nexa-demo-invitation-2026":`invite-${n}`,
    qrToken:n===3?"nexa-demo-pass-2026":`pass-${n}`,documentCaptured:status!=="invited",consentedAt:status!=="invited"?day(offset-1,12):undefined,
    denialReason:status==="denied"?"Identificación no presentada":undefined };
});

export const initialDemoState: DemoState = { visits:demoVisits, events:demoVisits.slice(0,10).map((v,i)=>({id:`event-${i}`,visitId:v.id,type:i%3===0?"check_in":"invitation_created",at:v.startsAt,actor:i%3===0?"Carlos Mendoza":v.hostName})) };
