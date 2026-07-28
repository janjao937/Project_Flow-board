"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  subscribePassphrasePrompt,
  type PassphraseRequest,
} from "./passphrase-prompt";

export function PassphrasePromptHost() {
  const t = useTranslations("security");
  const [request, setRequest] = useState<PassphraseRequest | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [encrypt, setEncrypt] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => subscribePassphrasePrompt(setRequest), []);

  useEffect(() => {
    if (!request) {
      setPassphrase("");
      setConfirm("");
      setEncrypt(false);
      setMismatch(false);
    }
  }, [request]);

  const open = request !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && request) {
          request.resolve(null);
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {request?.kind === "protect" ? t("protectTitle") : t("unlockTitle")}
          </DialogTitle>
          <DialogDescription>
            {request?.kind === "protect" ? t("protectBody") : t("unlockBody")}
          </DialogDescription>
        </DialogHeader>

        {request?.kind === "protect" ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(event) => {
                setEncrypt(event.target.checked);
                setMismatch(false);
              }}
            />
            <span>{t("encryptCheckbox")}</span>
          </label>
        ) : null}

        {request?.kind === "unlock" || encrypt ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="flowpkg-passphrase">{t("passphrase")}</Label>
              <Input
                id="flowpkg-passphrase"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </div>
            {request?.kind === "protect" ? (
              <div className="space-y-1">
                <Label htmlFor="flowpkg-passphrase-confirm">{t("confirmPassphrase")}</Label>
                <Input
                  id="flowpkg-passphrase-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
            ) : null}
            {mismatch ? <p className="text-destructive text-xs">{t("mismatch")}</p> : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              request?.resolve(null);
            }}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!request) {
                return;
              }
              if (request.kind === "unlock") {
                const value = passphrase.trim();
                if (!value) {
                  setMismatch(true);
                  return;
                }
                request.resolve(value);
                return;
              }
              if (!encrypt) {
                request.resolve({ encrypt: false });
                return;
              }
              if (!passphrase.trim() || passphrase !== confirm) {
                setMismatch(true);
                return;
              }
              request.resolve({ encrypt: true, passphrase });
            }}
          >
            {request?.kind === "protect" ? t("continue") : t("unlock")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
