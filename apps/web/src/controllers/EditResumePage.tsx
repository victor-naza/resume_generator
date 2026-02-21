import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeDto, ResumeSection, UpdateResumeInput } from "@curriculo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  createVersionRequest,
  downloadExportRequest,
  getResumeRequest,
  importTemplateRequest,
  listVersionsRequest,
  restoreVersionRequest,
  updateResumeRequest
} from "../models/resumes";
import { HeaderEditor } from "../views/editor/HeaderEditor";
import { SectionEditor } from "../views/editor/SectionEditor";
import { TemplateSelector } from "../views/editor/TemplateSelector";
import { ThemePanel } from "../views/editor/ThemePanel";
import { VersionsPanel } from "../views/editor/VersionsPanel";
import { ResumePreview } from "../views/ResumePreview";

import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/20/solid';
import { Fragment } from 'react';


const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildPayload = (resume: ResumeDto): UpdateResumeInput => ({
  title: resume.title,
  templateId: resume.templateId,
  content: resume.content,
  theme: resume.theme
});

const llmOptions = [
  {
    id: "gemini",
    label: "Gemini 2.5 Flash",
    provider: "gemini" as const,
    model: "gemini-2.5-flash",
    envHint: "GEMINI_API_KEY"
  },
  {
    id: "chatgpt",
    label: "ChatGPT 4.1 mini",
    provider: "chatgpt" as const,
    model: "gpt-4.1-mini",
    envHint: "OPENAI_API_KEY"
  }
] as const;

export const EditResumePage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ResumeDto | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedLlmId, setSelectedLlmId] = useState<(typeof llmOptions)[number]["id"]>("gemini");

  const resumeQuery = useQuery({
    queryKey: ["resume", id],
    queryFn: () => getResumeRequest(id!),
    enabled: Boolean(id)
  });

  const versionsQuery = useQuery({
    queryKey: ["versions", id],
    queryFn: () => listVersionsRequest(id!),
    enabled: Boolean(id)
  });

  useEffect(() => {
    if (resumeQuery.data) {
      setDraft(resumeQuery.data);
      setDirty(false);
      setStatusError(null);
    }
  }, [resumeQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateResumeInput) => updateResumeRequest(id!, payload),
    onSuccess: (updated) => {
      setDraft(updated);
      setDirty(false);
      setLastSavedAt(new Date());
      setStatusError(null);
      queryClient.setQueryData(["resume", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: (error) => {
      setStatusError(error instanceof Error ? error.message : "Erro ao salvar currículo");
    }
  });

  const createVersionMutation = useMutation({
    mutationFn: (name: string) => createVersionRequest(id!, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["versions", id] });
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => restoreVersionRequest(id!, versionId),
    onSuccess: (restored) => {
      setDraft(restored);
      setDirty(false);
      setStatusError(null);
      void queryClient.invalidateQueries({ queryKey: ["resume", id] });
      void queryClient.invalidateQueries({ queryKey: ["versions", id] });
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
    }
  });

  const importTemplateMutation = useMutation({
    mutationFn: (payload: { file: File; llmProvider: "gemini" | "chatgpt"; llmModel: string }) =>
      importTemplateRequest(id!, payload.file, {
        llmProvider: payload.llmProvider,
        llmModel: payload.llmModel
      }),
    onSuccess: (updated) => {
      setDraft(updated);
      setDirty(false);
      setLastSavedAt(new Date());
      setStatusError(null);
      setTemplateFile(null);
      setFileInputKey((value) => value + 1);
      queryClient.setQueryData(["resume", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
      void queryClient.invalidateQueries({ queryKey: ["versions", id] });
    },
    onError: (error) => {
      setStatusError(error instanceof Error ? error.message : "Erro ao importar modelo com IA");
    }
  });

  const saveNow = useCallback(() => {
    if (!draft || !dirty || !id || saveMutation.isPending) {
      return;
    }

    saveMutation.mutate(buildPayload(draft));
  }, [dirty, draft, id, saveMutation]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const timer = window.setInterval(() => {
      saveNow();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [dirty, saveNow]);

  useEffect(() => {
    const handler = () => {
      if (!draft || !dirty || !id) {
        return;
      }

      void updateResumeRequest(id, buildPayload(draft)).catch(() => {
        // best effort save before unload
      });
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, draft, id]);

  const handleDownload = async (format: "pdf") => {
    if (!id) {
      return;
    }

    try {
      const { blob, fileName } = await downloadExportRequest(id, format);
      downloadBlob(blob, fileName);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Falha ao exportar arquivo");
    }
  };

  const statusLabel = useMemo(() => {
    if (saveMutation.isPending) {
      return "Salvando...";
    }

    if (dirty) {
      return "Alterações não salvas";
    }

    if (lastSavedAt) {
      return `Último autosave: ${lastSavedAt.toLocaleTimeString("pt-BR")}`;
    }

    return "Tudo salvo";
  }, [dirty, lastSavedAt, saveMutation.isPending]);

  const selectedLlmOption = useMemo(
    () => llmOptions.find((option) => option.id === selectedLlmId) ?? llmOptions[0],
    [selectedLlmId]
  );

  const handlePreviewSectionsReorder = useCallback((sections: ResumeSection[]) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            content: {
              ...current.content,
              sections
            }
          }
        : current
    );
    setDirty(true);
  }, []);

  if (!id) {
    return <p className="text-sm text-red-600">ID de currículo inválido.</p>;
  }

  if (resumeQuery.isLoading || !draft) {
    return <p className="text-sm text-ink/70">Carregando currículo...</p>;
  }

  if (resumeQuery.isError) {
    return <p className="text-sm text-red-600">Não foi possível carregar o currículo.</p>;
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(720px,46vw)] xl:items-start">
      <div className="min-w-0 space-y-4">
        <article className="rounded-3xl border border-teal/20 bg-white p-4">
          <h1 className="font-heading text-2xl font-bold text-ink">Editor</h1>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink/70">
              Título do currículo
              <input
                value={draft.title}
                onChange={(event) => {
                  setDraft({ ...draft, title: event.target.value });
                  setDirty(true);
                }}
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
            </label>
            <div className="text-xs font-semibold text-ink/70">
              Status
              <div className="mt-1 rounded-xl border border-black/10 bg-slate-50 px-3 py-2 text-sm text-ink/80">
                {statusLabel}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveNow}
              disabled={saveMutation.isPending || !dirty}
              className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Salvar agora
            </button>
            <button
              type="button"
              onClick={() => handleDownload("pdf")}
              className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold"
            >
              Exportar PDF
            </button>
          </div>

          {statusError && <p className="mt-3 text-sm text-red-600">{statusError}</p>}
        </article>

        <article className="rounded-3xl border border-teal/20 bg-white p-4">
          <h2 className="font-heading text-base font-bold text-ink">Template</h2>
          <div className="mt-3">
            <TemplateSelector
              value={draft.templateId}
              onChange={(templateId) => {
                setDraft({ ...draft, templateId });
                setDirty(true);
              }}
            />
          </div>
        </article>

        <article className="rounded-3xl border border-teal/20 bg-white p-4">
          <h2 className="font-heading text-base font-bold text-ink">Importar modelo com IA</h2>
          <p className="mt-1 text-xs text-ink/70">
            Envie print ou arquivo (.png, .jpg, .pdf, .docx, .txt). A IA copia esse modelo para o formato editavel do projeto.
          </p>

          <div className="flex flex-col gap-1">
  <span className="text-xs font-semibold text-ink/70">Modelo</span>
  <Listbox
    value={selectedLlmId}
    onChange={(value) => setSelectedLlmId(value)}
  >
    <div className="relative mt-1">
      {/* Botão Arredondado (Pílula) */}
      <ListboxButton className="relative w-full cursor-default rounded-full border border-black/10 bg-white py-2 pl-4 pr-10 text-left text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 transition-all">
        <span className="block truncate">
          {llmOptions.find((opt) => opt.id === selectedLlmId)?.label}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </span>
      </ListboxButton>

      <Transition
        as={Fragment}
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        {/* Caixa de Opções Arredondada */}
        <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-2xl bg-white py-1 text-sm shadow-xl ring-1 ring-black/5 focus:outline-none">
          {llmOptions.map((option) => (
            <ListboxOption
              key={option.id}
              value={option.id}
              className={({ focus }) =>
                `relative cursor-default select-none py-2 pl-10 pr-4 transition-colors ${
                  focus ? 'bg-teal/10 text-teal-900' : 'text-ink'
                }`
              }
            >
              {({ selected }) => (
                <>
                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                    {option.label}
                  </span>
                  {selected ? (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-teal-600">
                      <CheckIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  ) : null}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Transition>
    </div>
  </Listbox>
</div>
          <div className="mt-3">
            <input
              key={fileInputKey}
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.txt,.md,.rtf"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setTemplateFile(nextFile);
              }}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink hover:border-teal"
              >
                {templateFile ? "Trocar arquivo" : "Selecionar arquivo"}
              </button>
              <span className="text-xs text-ink/70">
                {templateFile ? templateFile.name : "Nenhum arquivo selecionado"}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!templateFile) {
                  setStatusError("Selecione um arquivo para importar.");
                  return;
                }

                setStatusError(null);
                importTemplateMutation.mutate({
                  file: templateFile,
                  llmProvider: selectedLlmOption.provider,
                  llmModel: selectedLlmOption.model
                });
              }}
              disabled={importTemplateMutation.isPending || !templateFile}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {importTemplateMutation.isPending ? "Analisando..." : "Analisar e aplicar modelo"}
            </button>
            <p className="self-center text-xs text-ink/60">
              Requer API ativa (`VITE_USE_API=true`) e {selectedLlmOption.envHint} no backend.
            </p>
          </div>
        </article>

        <HeaderEditor
          header={draft.content.header}
          onChange={(header) => {
            setDraft({
              ...draft,
              content: {
                ...draft.content,
                header
              }
            });
            setDirty(true);
          }}
        />

        <ThemePanel
          theme={draft.theme}
          onChange={(theme) => {
            setDraft({ ...draft, theme });
            setDirty(true);
          }}
        />

        <SectionEditor
          sections={draft.content.sections}
          onChange={(sections) => {
            setDraft({
              ...draft,
              content: {
                ...draft.content,
                sections
              }
            });
            setDirty(true);
          }}
        />

        <VersionsPanel
          versions={versionsQuery.data ?? []}
          loading={versionsQuery.isLoading}
          creating={createVersionMutation.isPending}
          restoringVersionId={restoringVersionId}
          onCreate={(name) => createVersionMutation.mutate(name)}
          onRestore={(versionId) => {
            setRestoringVersionId(versionId);
            restoreMutation.mutate(versionId, {
              onSettled: () => setRestoringVersionId(null)
            });
          }}
        />
      </div>

      <aside className="min-w-0 xl:w-full xl:flex-none xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:pl-3 xl:border-l xl:border-black/10">
        <h2 className="mb-2 font-heading text-xl font-bold text-ink">Preview</h2>
        <ResumePreview resume={draft} onSectionsReorder={handlePreviewSectionsReorder} />
      </aside>
    </section>
  );
};

