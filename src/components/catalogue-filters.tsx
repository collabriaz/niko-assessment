"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humanise } from "@/lib/format";

type Props = {
  mediaTypes: string[];
  locations: { id: string; name: string }[];
  values: {
    startDate: string;
    endDate: string;
    mediaType: string | null;
    locationId: string | null;
    maxMonthlyBudget: string;
  };
};

const ANY_MEDIA = "Any media type";
const ANY_LOCATION = "Any location";

export const CatalogueFilters = ({ mediaTypes, locations, values }: Props) => {
  const router = useRouter();
  const [form, setForm] = useState(values);
  const set = <K extends keyof Props["values"]>(
    key: K,
    value: Props["values"][K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const apply = () => {
    const query = new URLSearchParams({
      startDate: form.startDate,
      endDate: form.endDate,
    });

    if (form.mediaType) query.set("mediaType", form.mediaType);
    if (form.locationId) query.set("locationId", form.locationId);
    if (form.maxMonthlyBudget)
      query.set("maxMonthlyBudget", form.maxMonthlyBudget);

    router.push(`/catalogue?${query}`);
  };

  return (
    <form
      className="grid gap-4 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <div className="grid gap-1.5 text-sm">
        <label className="font-medium" htmlFor="startDate">
          From
        </label>
        <Input
          id="startDate"
          type="date"
          value={form.startDate}
          onChange={(event) => set("startDate", event.target.value)}
        />
      </div>

      <div className="grid gap-1.5 text-sm">
        <label className="font-medium" htmlFor="endDate">
          To
        </label>
        <Input
          id="endDate"
          type="date"
          value={form.endDate}
          onChange={(event) => set("endDate", event.target.value)}
        />
      </div>

      <div className="grid gap-1.5 text-sm">
        <span className="font-medium" id="mediaTypeLabel">
          Media type
        </span>
        <Select
          value={form.mediaType}
          onValueChange={(value: string | null) => set("mediaType", value)}
        >
          <SelectTrigger aria-labelledby="mediaTypeLabel">
            <SelectValue>
              {(value: string | null) => (value ? humanise(value) : ANY_MEDIA)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{ANY_MEDIA}</SelectItem>
            {mediaTypes.map((mediaType) => (
              <SelectItem key={mediaType} value={mediaType}>
                {humanise(mediaType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5 text-sm">
        <span className="font-medium" id="locationLabel">
          Location
        </span>
        <Select
          value={form.locationId}
          onValueChange={(value: string | null) => set("locationId", value)}
        >
          <SelectTrigger aria-labelledby="locationLabel">
            <SelectValue>
              {(value: string | null) =>
                locations.find((location) => location.id === value)?.name ??
                ANY_LOCATION
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{ANY_LOCATION}</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5 text-sm">
        <label className="font-medium" htmlFor="maxMonthlyBudget">
          Max monthly budget
        </label>
        <Input
          id="maxMonthlyBudget"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Any"
          value={form.maxMonthlyBudget}
          onChange={(event) => set("maxMonthlyBudget", event.target.value)}
        />
      </div>

      <div className="flex items-end">
        <Button type="submit" className="w-full">
          Apply
        </Button>
      </div>
    </form>
  );
};
