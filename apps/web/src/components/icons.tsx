import {
	BoldIcon,
	BookOpenIcon,
	BotMessageSquareIcon,
	BrowserIcon as BrowserIconData,
	Calendar01Icon,
	Cancel01Icon,
	ChartColumnIcon,
	CheckIcon,
	ChevronDownIcon,
	CodeIcon,
	CodeSquareIcon,
	ComputerIcon,
	ExternalLinkIcon,
	FileCodeIcon,
	FileSlidersIcon,
	FileSymlinkIcon,
	FlaskConicalIcon,
	FolderKanbanIcon,
	GitBranchIcon,
	GlobeIcon,
	HardDriveIcon,
	Heading02Icon,
	Heading03Icon,
	Heading04Icon,
	ItalicIcon,
	KeyRoundIcon,
	LayersIcon,
	LayoutDashboardIcon,
	Link02Icon,
	ListIcon,
	ListOrderedIcon,
	ListTodoIcon,
	Logout01Icon,
	Mail01Icon,
	MinusIcon,
	MonitorSmartphoneIcon,
	PlusIcon,
	QuoteUpIcon,
	RadarIcon,
	RadioIcon,
	Redo02Icon,
	SearchIcon,
	ServerIcon,
	Settings01Icon,
	Settings02Icon,
	SparkleIcon,
	SquareKanbanIcon,
	SquarePenIcon,
	StrikethroughIcon,
	TableIcon as TableIconData,
	Undo02Icon,
	Unlink01Icon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ComponentType } from "react";

export type IconComponent = ComponentType<{ className?: string }>;

function makeIcon(icon: IconSvgElement): IconComponent {
	return function Icon({ className }: { className?: string }) {
		return (
			<HugeiconsIcon className={className} icon={icon} strokeWidth={2.25} />
		);
	};
}

export const BotMessageSquare = makeIcon(BotMessageSquareIcon);
export const ChartColumn = makeIcon(ChartColumnIcon);
export const Computer = makeIcon(ComputerIcon);
export const FileCode = makeIcon(FileCodeIcon);
export const FileSliders = makeIcon(FileSlidersIcon);
export const FileSymlink = makeIcon(FileSymlinkIcon);
export const FlaskConical = makeIcon(FlaskConicalIcon);
export const FolderKanban = makeIcon(FolderKanbanIcon);
export const GitBranch = makeIcon(GitBranchIcon);
export const Globe = makeIcon(GlobeIcon);
export const HardDrive = makeIcon(HardDriveIcon);
export const Server = makeIcon(ServerIcon);
export const Sparkle = makeIcon(SparkleIcon);
export const User = makeIcon(UserIcon);
export const Browser = makeIcon(BrowserIconData);
export const LayoutDashboard = makeIcon(LayoutDashboardIcon);
export const BookOpen = makeIcon(BookOpenIcon);
export const Radar = makeIcon(RadarIcon);
export const Radio = makeIcon(RadioIcon);
export const SquareKanban = makeIcon(SquareKanbanIcon);
export const Check = makeIcon(CheckIcon);
export const ChevronDown = makeIcon(ChevronDownIcon);
export const Layers = makeIcon(LayersIcon);
export const Plus = makeIcon(PlusIcon);
export const Search = makeIcon(SearchIcon);
export const Settings = makeIcon(Settings01Icon);
export const Settings2 = makeIcon(Settings02Icon);
export const SquarePen = makeIcon(SquarePenIcon);
export const Bold = makeIcon(BoldIcon);
export const Code = makeIcon(CodeIcon);
export const Heading2 = makeIcon(Heading02Icon);
export const Heading3 = makeIcon(Heading03Icon);
export const Heading4 = makeIcon(Heading04Icon);
export const Italic = makeIcon(ItalicIcon);
export const Link2 = makeIcon(Link02Icon);
export const List = makeIcon(ListIcon);
export const ListOrdered = makeIcon(ListOrderedIcon);
export const ListTodo = makeIcon(ListTodoIcon);
export const Minus = makeIcon(MinusIcon);
export const Quote = makeIcon(QuoteUpIcon);
export const Redo2 = makeIcon(Redo02Icon);
export const SquareCode = makeIcon(CodeSquareIcon);
export const Strikethrough = makeIcon(StrikethroughIcon);
export const TableIcon = makeIcon(TableIconData);
export const Undo2 = makeIcon(Undo02Icon);
export const X = makeIcon(Cancel01Icon);
export const Calendar = makeIcon(Calendar01Icon);
export const Mail = makeIcon(Mail01Icon);
export const Unlink = makeIcon(Unlink01Icon);
export const ExternalLink = makeIcon(ExternalLinkIcon);
export const MonitorSmartphone = makeIcon(MonitorSmartphoneIcon);
export const LogOut = makeIcon(Logout01Icon);
export const KeyRound = makeIcon(KeyRoundIcon);
