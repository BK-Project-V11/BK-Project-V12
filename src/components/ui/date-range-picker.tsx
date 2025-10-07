import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { id } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  value: {
    from: Date;
    to: Date;
  };
  onValueChange: (value: { from: Date; to: Date }) => void;
  className?: string;
}

export function DateRangePicker({
  value,
  onValueChange,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd MMMM yyyy", { locale: id })} -{" "}
                  {format(value.to, "dd MMMM yyyy", { locale: id })}
                </>
              ) : (
                format(value.from, "dd MMMM yyyy", { locale: id })
              )
            ) : (
              <span>Pilih tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={{ 
              from: value?.from, 
              to: value?.to 
            }}
            onSelect={(selected: { from?: Date; to?: Date }) => {
              if (selected?.from && selected?.to) {
                // Set time to start of day for 'from' date
                const fromDate = new Date(selected.from);
                fromDate.setHours(0, 0, 0, 0);

                // Set time to end of day for 'to' date
                const toDate = new Date(selected.to);
                toDate.setHours(23, 59, 59, 999);

                onValueChange({
                  from: fromDate,
                  to: toDate,
                });
              }
            }}
            numberOfMonths={2}
            locale={id}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}