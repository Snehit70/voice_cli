import { useEffect, useState } from "react";
import { LiveWaveform } from "./LiveWaveform";

declare global {
	interface Window {
		electronAPI?: {
			onToggleListening: (callback: () => void) => () => void;
			notifyReady: () => void;
		};
	}
}

export function App() {
	const [active, setActive] = useState(true);

	useEffect(() => {
		window.electronAPI?.onToggleListening(() => {
			setActive((prev) => !prev);
		});

		window.electronAPI?.notifyReady();
	}, []);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "rgba(10, 10, 15, 0.6)",
				borderRadius: "8px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				position: "relative",
			}}
		>
			<LiveWaveform
				active={active}
				mode="static"
				barColor="rgba(255, 255, 255, 0.9)"
				barWidth={3}
				barGap={2}
				barRadius={1.5}
				height={50}
				fadeEdges={true}
				style={{ width: "100%", height: "100%" }}
			/>
			{!active && (
				<span
					style={{
						color: "rgba(255, 255, 255, 0.7)",
						fontFamily:
							"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
						fontSize: "14px",
						position: "absolute",
						pointerEvents: "none",
					}}
				>
					Start listening...
				</span>
			)}
		</div>
	);
}
