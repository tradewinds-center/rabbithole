const TOOL_LABELS: Record<string, string> = {
  // Scholar tools
  edit_document: "Editing document",
  create_code: "Creating code",
  generate_image: "Generating image",
  update_dossier: "Updating scholar profile",
  update_process_step: "Updating process step",
  // Curriculum tools
  list_scholars: "Looking up scholars",
  get_scholar_dossier: "Reading scholar profile",
  get_mastery_data: "Fetching mastery data",
  get_scholar_mastery: "Fetching mastery data",
  get_session_signals: "Reading session signals",
  get_scholar_signals: "Reading session signals",
  get_seeds: "Loading exploration seeds",
  get_scholar_seeds: "Loading exploration seeds",
  get_observations: "Reading observations",
  get_scholar_observations: "Reading observations",
  list_units: "Loading units",
  get_unit_details: "Reading unit details",
  // Unit designer tools
  read_unit_structure: "Reading unit structure",
  update_unit: "Updating unit",
  create_lesson: "Creating lesson",
  update_lesson: "Updating lesson",
  delete_lesson: "Deleting lesson",
  generate_lesson_prompt: "Generating lesson prompt",
  generate_all_prompts: "Checking lessons for prompts",
};

export function friendlyToolName(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}
