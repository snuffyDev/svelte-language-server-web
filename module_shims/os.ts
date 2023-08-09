/** esbuild-ignore */
// @ts=ignore
import process from "process";

export const EOL = "\n";
export function platform() {
	return "linux";
}

const mod = {
	EOL,
	platform,
	cpus() {
		return 4;
	},
	type() {
		return [
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 1187,
				times: {
					user: 25927360,
					nice: 57120,
					sys: 5705250,
					idle: 105068660,
					irq: 719580,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 1182,
				times: {
					user: 25706280,
					nice: 63100,
					sys: 5746190,
					idle: 105193200,
					irq: 731680,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 2400,
				times: {
					user: 25989800,
					nice: 70700,
					sys: 5478980,
					idle: 105364510,
					irq: 695350,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 1178,
				times: {
					user: 27152300,
					nice: 53390,
					sys: 5701340,
					idle: 104267070,
					irq: 697970,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 1099,
				times: {
					user: 25973010,
					nice: 54030,
					sys: 5529940,
					idle: 105264670,
					irq: 718310,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 1156,
				times: {
					user: 26049910,
					nice: 76590,
					sys: 5283220,
					idle: 105340290,
					irq: 718270,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 869,
				times: {
					user: 26031060,
					nice: 63370,
					sys: 5413430,
					idle: 104885260,
					irq: 1198000,
				},
			},
			{
				model: "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz",
				speed: 1110,
				times: {
					user: 24222570,
					nice: 50080,
					sys: 5775940,
					idle: 104986880,
					irq: 1917100,
				},
			},
		];
	},
};

export default mod;
