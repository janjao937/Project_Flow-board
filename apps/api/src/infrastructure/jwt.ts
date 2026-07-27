import { SignJWT, jwtVerify } from "jose";
import type { ParticipantClaims } from "../domain/session";

const encoder = new TextEncoder();

export async function signParticipantToken(
  claims: ParticipantClaims,
  secret: string,
  expiresIn = "8h",
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret));
}

export async function verifyParticipantToken(
  token: string,
  secret: string,
): Promise<ParticipantClaims> {
  const { payload } = await jwtVerify(token, encoder.encode(secret));
  return {
    sessionId: String(payload.sessionId),
    workflowId: String(payload.workflowId),
    participantId: String(payload.participantId),
    displayName: String(payload.displayName),
    role: payload.role === "host" ? "host" : "guest",
    canEdit: Boolean(payload.canEdit),
  };
}
