export interface Machine {
  id?: number;
  name: string;
  host: string;
  hardware_model: string;
  hardware_vendor: string;
  processor: string;
  memory: string;
  graphics: string;
  disk_capacity: string;
  os_name: string;
  os_type: string;
  gnome_version: string;
  windowing_system: string;
  kernel: string;
  notes: string;
}

export const emptyMachine = (): Machine => ({
  name: "",
  host: "",
  hardware_model: "",
  hardware_vendor: "",
  processor: "",
  memory: "",
  graphics: "",
  disk_capacity: "",
  os_name: "",
  os_type: "",
  gnome_version: "",
  windowing_system: "",
  kernel: "",
  notes: "",
});