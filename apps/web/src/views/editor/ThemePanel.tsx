import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/20/solid';
import { Fragment } from 'react';
import type { ResumeTheme } from "@curriculo/shared";

interface ThemePanelProps {
  theme: ResumeTheme;
  onChange: (theme: ResumeTheme) => void;
}

// Componente auxiliar para evitar repetição de código nos Selects
const CustomSelect = ({ label, value, options, onChange }: any) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink/70">{label}</span>
      <Listbox value={value} onChange={onChange}>
        <div className="relative mt-1">
          <ListboxButton className="relative w-full cursor-default rounded-full border border-black/10 bg-white py-2 pl-4 pr-10 text-left text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 transition-all">
            <span className="block truncate capitalize">{value}</span>
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
            <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-2xl bg-white py-1 text-sm shadow-xl ring-1 ring-black/5 focus:outline-none">
              {options.map((option: any) => (
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
                        {option.name}
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
  );
};

export const ThemePanel = ({ theme, onChange }: ThemePanelProps) => {
  return (
    <section className="rounded-3xl border border-teal/20 bg-white p-4">
      <h2 className="font-heading text-base font-bold text-ink">Tema</h2>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {/* Cores mantidas com rounded-full original */}
        <label className="text-xs font-semibold text-ink/70">
          Cor primária
          <input
            className="mt-1 h-8 w-full rounded-full p-0 cursor-pointer"
            type="color"
            value={theme.primaryColor}
            onChange={(event) => onChange({ ...theme, primaryColor: event.target.value })}
          />
        </label>
        
        <label className="text-xs font-semibold text-ink/70">
          Cor secundária
          <input
            className="mt-1 h-8 w-full rounded-full p-0 cursor-pointer"
            type="color"
            value={theme.secondaryColor}
            onChange={(event) => onChange({ ...theme, secondaryColor: event.target.value })}
          />
        </label>

        <label className="text-xs font-semibold text-ink/70">
          Cor de texto
          <input
            className="mt-1 h-8 w-full rounded-full p-0 cursor-pointer"
            type="color"
            value={theme.textColor}
            onChange={(event) => onChange({ ...theme, textColor: event.target.value })}
          />
        </label>

        {/* Novos Selects Arredondados com Headless UI */}
        <CustomSelect
          label="Fonte"
          value={theme.font}
          options={[
            { id: 'sourceSans', name: 'Source Sans' },
            { id: 'merriweather', name: 'Merriweather' },
            { id: 'montserrat', name: 'Montserrat' },
          ]}
          onChange={(val: any) => onChange({ ...theme, font: val })}
        />

        <CustomSelect
          label="Espaçamento"
          value={theme.spacing}
          options={[
            { id: 'compact', name: 'Compacto' },
            { id: 'comfortable', name: 'Confortável' },
          ]}
          onChange={(val: any) => onChange({ ...theme, spacing: val })}
        />

        <CustomSelect
          label="Tamanho de fonte"
          value={theme.fontSizeLevel}
          options={[
            { id: 'normal', name: 'Normal' },
            { id: 'large', name: 'Grande' },
          ]}
          onChange={(val: any) => onChange({ ...theme, fontSizeLevel: val })}
        />
      </div>
    </section>
  );
};