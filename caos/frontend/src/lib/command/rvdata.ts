// Sector RV dataset — Concept A "Sector RV" view.
// Sector peer loan tables (issuer + loan data, spread-implied liquidity, mid
// RV assessment, price deltas) with US Leveraged Loan index statistics and
// per-rating-bucket averages. Entertainment mirrors the desk sample; the
// other sectors carry representative demo rows.

export type Liquidity = "High" | "Normal" | "OK" | "Concerning" | "Impaired";

// Liquidity ↔ Mid-RV assessment pairs (consistent in the desk sheet).
export const RV_LABEL: Record<Liquidity, string> = {
  High: "Reliable",
  Normal: "Acceptable",
  OK: "+DM Comp",
  Concerning: "Overstated",
  Impaired: "Uncertain",
};

export interface RVRow {
  company: string;
  sub: string;
  pub: string; // Public | Private
  figi: string;
  rank: string;
  rating: string; // "B1 / B+"
  size: number; // $Mn
  margin: number; // bps
  maturity: string; // dd-MMM-yy
  bid: number;
  ask: number;
  liq: Liquidity;
  d: (number | null)[]; // Δ1D Δ1W Δ1M Δ3M Δ6M Δ1YR ΔYTD
  ytm: number;
  dm: number; // 3Y discount margin
}

// [company, sub, pub, figi, rank, rating, size, margin, maturity, bid, ask, liq, ...deltas, ytm, dm]
type T = [string, string, string, string, string, string, number, number, string, number, number, Liquidity, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number, number];

const row = (t: T): RVRow => ({
  company: t[0], sub: t[1], pub: t[2], figi: t[3], rank: t[4], rating: t[5],
  size: t[6], margin: t[7], maturity: t[8], bid: t[9], ask: t[10], liq: t[11],
  d: [t[12], t[13], t[14], t[15], t[16], t[17], t[18]], ytm: t[19], dm: t[20],
});

const GTD = "1L Gtd Sr. Secd";
const SR = "1L Sr. Secd";

const ENTERTAINMENT: T[] = [
  ["Alterra Mountain", "Ski Resorts / Destination Mountain Recreation", "Private", "BBG01W9CXRY9", GTD, "B1 / B+", 1584, 250, "17-Aug-28", 100.0, 100.5, "Normal", 0.0, -0.06, -0.25, 0.13, -0.38, -0.25, -0.38, 6.0, 238],
  ["Alterra Mountain", "Ski Resorts / Destination Mountain Recreation", "Private", "BBG01W3V21M7", GTD, "B1 / B+", 1100, 250, "31-May-30", 100.13, 100.63, "Normal", 0.0, -0.13, -0.08, 0.25, -0.25, -0.08, -0.25, 6.0, 236],
  ["AMC Entertainment Holdings", "Cinema Exhibition", "Public", "BBG01NY6L799", GTD, "B3 / B", 2024, 700, "04-Jan-29", 100.13, 100.38, "High", 0.0, -0.25, 0.06, 2.75, -0.13, 0.06, 0.0, 10.5, 689],
  ["Arcis Golf", "Golf Clubs / Course Operations", "Private", "BBG01RXFVRQ7", SR, "B2 / B+", 645, 275, "24-Nov-28", 100.13, 100.63, "Normal", 0.0, -0.25, -0.13, 0.13, -0.38, -0.13, 0.0, 5.8, 212],
  ["ATG", "Theatre Venues / Live Entertainment", "Private", "BBG01XH90W52", GTD, "B2 / B", 550, 300, "19-Apr-32", 99.75, 100.5, "Normal", 0.0, -0.13, 0.0, -0.25, -0.5, 0.0, 0.63, 6.6, 295],
  ["Banijay", "TV Production / Content Studios", "Private", "BBG01RR9FZ51", GTD, "B2 / B+", 500, 275, "01-Mar-28", 100.38, 100.75, "High", 0.0, -0.13, -0.25, 0.44, -0.19, -0.25, -0.31, 6.0, 240],
  ["Bay Club", "Fitness Clubs / Lifestyle Clubs", "Private", "BBG01ZRHCRL8", GTD, "B3 / B", 1200, 325, "07-Feb-33", 100.0, 100.38, "High", 0.0, -0.38, -0.56, 0.06, null, -0.56, null, 6.8, 318],
  ["CAA", "Talent Representation / Sports & Entertainment Agency", "Private", "BBG01W3DRTY6", GTD, "B2 / B+", 2588, 250, "01-Oct-31", 100.0, 100.38, "High", 0.0, -0.31, -0.44, 0.13, -0.31, -0.44, -0.31, 6.1, 242],
  ["Cedar Fair", "Theme Parks / Amusement Parks", "Public", "BBG01K0VMGS5", GTD, "Ba3 / BB", 1500, 200, "01-May-31", 99.0, 99.5, "Normal", -0.13, -0.31, -0.75, 0.06, 0.25, -0.75, 0.25, 5.8, 227],
  ["Cirque Du Soleil", "Live Entertainment / Theatrical Productions", "Private", "BBG01MYR4T32", GTD, "B2 / B", 515, 375, "08-Mar-30", 95.25, 96.75, "OK", 0.0, -1.0, 1.0, 1.5, 3.0, 1.0, 6.0, 8.7, 531],
  ["Endeavor", "Talent Representation / Sports & Entertainment Platforms", "Private", "BBG01RV8WWW6", SR, "B2 / B+", 3000, 275, "24-Mar-32", 100.13, 100.88, "Normal", 0.38, 0.06, -0.31, 0.5, -0.19, -0.31, -0.38, 6.3, 257],
  ["Endeavor", "Talent Representation / Sports & Entertainment Platforms", "Private", "BBG01S2SSH05", SR, "B2 / B+", 1250, 375, "24-Mar-28", 99.88, 100.63, "Normal", 0.13, 0.0, -0.13, 0.13, -0.13, -0.13, -0.25, 7.2, 360],
  ["Entertainment Partners", "Entertainment Payroll / Production Services", "Private", "BBG012YQ6W75", GTD, "B3 / B", 850, 350, "06-Nov-28", 66.5, 67.5, "OK", -2.5, -1.0, -5.5, 8.5, -8.0, -5.5, -6.5, 25.8, 2203],
  ["Formula One", "Sports Rights / Motorsport", "Public", "BBG01PMLP1F6", SR, "NR / BB", 1700, 200, "19-Sep-31", 100.0, 100.5, "Normal", 0.0, -0.13, -0.25, 0.25, -0.31, -0.25, -0.25, 5.6, 191],
  ["Formula One", "Sports Rights / Motorsport", "Public", "BBG01PKM34L7", SR, "NR / BB", 850, 200, "19-Sep-31", 100.63, 100.63, "High", null, null, null, null, null, null, 0.38, 5.5, 177],
  ["LA Fitness", "Fitness Clubs / Gyms", "Private", "BBG01VT81Q93", SR, "B3 / B-", 667, 450, "12-Feb-29", 99.88, 100.63, "Normal", 0.0, 0.0, -0.63, -0.5, -0.25, -0.63, 0.13, 8.0, 439],
  ["Live Nation", "Concert Promotion / Ticketing / Venues", "Public", "BBG01XSVC1K9", GTD, "Ba1 / BB", 1300, 200, "21-Oct-32", 99.88, 100.38, "Normal", 0.0, -0.25, -0.16, -0.13, -0.13, -0.16, -0.13, 5.6, 195],
  ["Merlin Entertainments", "Theme Parks / Visitor Attractions", "Private", "BBG01L0R3FR6", GTD, "B3 / B-", 1385, 350, "30-Nov-29", 78.0, 81.0, "Concerning", -0.5, -4.5, -9.5, -4.25, -9.38, -9.5, -9.25, 14.8, 1222],
  ["NEP Group", "Broadcast Production Services / Live Event Technology", "Private", "BBG01XMMM874", GTD, "B3 / B-", 1450, 450, "17-Oct-31", 92.5, 94.0, "OK", 0.25, -0.25, 2.75, 2.48, 2.63, 2.75, 0.5, 9.7, 714],
  ["Playtika", "Mobile Gaming / Social Casino", "Public", "BBG00ZGXN248", GTD, "Ba2 / BB", 1900, 275, "13-Mar-28", 97.0, 97.75, "Normal", 0.0, -0.56, -0.88, 4.38, 0.63, -0.88, 0.38, 8.1, 438],
  ["Plusgrade", "Travel Technology / Ancillary Revenue Software", "Private", "BBG01SMZ1VF9", GTD, "B2 / B", 372, 350, "03-Mar-31", 98.25, 99.25, "OK", 0.5, -0.25, -0.5, 2.75, -1.63, -0.5, -1.88, 7.4, 397],
  ["Regal Cineworld", "Cinema Exhibition", "Private", "BBG01VR293S0", GTD, "B3 / B", 1891, 450, "02-Dec-31", 100.25, 100.75, "Normal", 0.25, 0.0, 0.0, 1.88, 0.81, 0.0, 1.75, 8.0, 431],
  ["Renaissance Learning", "K-12 Assessment / Learning Software", "Private", "BBG01R37YR12", GTD, "B3 / B-", 2000, 400, "08-Apr-30", 78.0, 80.0, "Concerning", 0.0, 0.0, -2.5, 5.63, -7.75, -2.5, -8.25, 15.1, 1319],
  ["TKO Worldwide Holdings", "Sports Entertainment / Combat Sports", "Public", "BBG01X3LBFL7", GTD, "Ba2 / BB", 4636, 200, "21-Nov-31", 99.88, 100.25, "High", 0.0, -0.13, -0.56, -0.25, -0.5, -0.56, -0.5, 5.9, 204],
  ["United Talent Agency", "Talent Representation / Sports & Entertainment Agency", "Private", "BBG01YLGPLF5", GTD, "B2 / B+", 927, 300, "10-Jun-32", 100.25, 100.75, "Normal", 0.13, 0.0, -0.38, 0.25, -0.25, -0.38, -0.38, 6.5, 281],
  ["Varsity Brands", "School Spirit / Cheerleading Events & Apparel", "Private", "BBG01X575V92", GTD, "B2 / B", 2769, 300, "26-Aug-31", 100.19, 100.44, "High", -0.03, -0.06, 0.31, 0.31, -0.31, 0.31, -0.25, 6.5, 287],
  ["Vivid Seats", "Ticketing Marketplace", "Public", "BBG01S0STQ06", SR, "Caa1 / B-", 393, 225, "05-Feb-29", 40.0, 44.0, "Impaired", -6.0, -6.0, 1.5, -5.75, -13.5, 1.5, -13.5, 44.7, 4103],
  ["World Choice Investments", "Hospitality / Attraction Operations", "Private", "BBG01P0KG8P6", SR, "B3 / B-", 400, 475, "18-Aug-31", 99.0, 100.0, "OK", 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, -0.25, 8.5, 494],
];

const TELECOM: T[] = [
  ["Zayo Group", "Fiber Infrastructure / Bandwidth", "Private", "BBG00P3HMQK4", GTD, "B3 / B-", 4960, 300, "01-Mar-27", 96.88, 97.38, "High", 0.0, -0.19, -0.5, 1.25, 0.88, -0.5, 0.63, 8.2, 521],
  ["Lumen Technologies", "ILEC / Enterprise Connectivity", "Public", "BBG00R5LKNP2", SR, "B3 / B-", 2400, 235, "01-Apr-30", 95.5, 96.25, "Normal", -0.13, -0.25, -0.63, 2.13, 1.5, -0.63, 1.88, 8.9, 568],
  ["Frontier Communications", "Fiber Broadband / Consumer", "Public", "BBG00ZJ6P5L8", GTD, "B2 / B+", 1625, 350, "01-Jul-31", 99.75, 100.25, "Normal", 0.0, -0.06, -0.13, 0.38, -0.25, -0.13, 0.13, 7.3, 362],
  ["Windstream", "Rural ILEC / Managed Services", "Private", "BBG00WJP7H92", GTD, "B2 / B", 750, 400, "23-Sep-31", 100.0, 100.5, "Normal", 0.0, -0.13, -0.25, 0.25, -0.19, -0.25, -0.06, 7.9, 412],
  ["Consolidated Communications", "Regional Broadband", "Public", "BBG00Q9K2BX1", GTD, "B3 / B-", 1000, 350, "04-Oct-28", 94.13, 95.0, "OK", 0.13, -0.5, -1.13, 1.63, -2.25, -1.13, -1.5, 9.4, 641],
  ["Altice France", "Cable / Convergent Operator", "Private", "BBG00VR8T4N6", GTD, "Caa2 / CCC+", 2150, 550, "15-Aug-28", 78.25, 79.75, "Concerning", -0.38, -2.13, -4.75, -3.5, -8.13, -4.75, -7.88, 16.2, 1455],
  ["Radiate Holdco", "Regional Cable / Astound", "Private", "BBG00X2D5RW3", GTD, "Caa1 / CCC", 1900, 325, "25-Sep-26", 84.5, 86.0, "Concerning", -0.25, -1.0, -2.88, -1.75, -5.5, -2.88, -4.13, 14.6, 1238],
  ["Crown Castle Fiber Carve-out", "Towers / Small Cells JV", "Private", "BBG01Y4WCT85", SR, "Ba3 / BB-", 1250, 250, "12-Jan-32", 100.13, 100.5, "High", 0.0, -0.06, 0.13, 0.5, 0.25, 0.13, 0.31, 6.2, 248],
  ["Viasat", "Satellite Broadband / Gov Comms", "Public", "BBG00ZTKR7V0", GTD, "B2 / B+", 700, 450, "30-May-30", 97.5, 98.25, "OK", 0.25, -0.31, -0.75, 1.13, -1.38, -0.75, -0.88, 9.1, 583],
  ["Numericable U.S. Holdings", "Cable Aggregation Vehicle", "Private", "BBG00T8MZKD9", SR, "B3 / B-", 525, 425, "08-Nov-29", 91.75, 93.25, "OK", 0.0, -0.63, -1.5, 0.88, -2.0, -1.5, -1.25, 10.3, 742],
];

const IT_SERVICES: T[] = [
  ["Presidio", "IT Solutions Integrator", "Private", "BBG00WQH4JX2", GTD, "B1 / B+", 1850, 350, "19-Feb-31", 100.25, 100.63, "High", 0.0, 0.0, 0.13, 0.44, 0.25, 0.13, 0.38, 7.1, 351],
  ["Ahead DB Holdings", "Enterprise Cloud / Data Center Services", "Private", "BBG00ZD8WMR5", GTD, "B2 / B", 1310, 375, "18-Oct-31", 100.0, 100.5, "Normal", 0.0, -0.13, -0.06, 0.31, 0.13, -0.06, 0.25, 7.5, 379],
  ["Peraton", "Defense IT / Mission Services", "Private", "BBG00YV3RKT8", GTD, "B2 / B", 5305, 375, "01-Feb-28", 98.63, 99.13, "Normal", -0.06, -0.25, -0.5, 0.75, -0.63, -0.5, -0.31, 8.0, 446],
  ["Amentum", "Government Technical Services", "Public", "BBG01H7QPVN4", SR, "Ba3 / BB-", 2125, 275, "29-Jul-31", 100.31, 100.63, "High", 0.0, 0.06, 0.19, 0.5, 0.38, 0.19, 0.44, 6.4, 271],
  ["Gainwell Acquisition", "Healthcare IT / Medicaid Systems", "Private", "BBG00X9JLWB3", GTD, "B3 / B-", 4060, 400, "01-Oct-27", 88.5, 89.75, "OK", -0.13, -0.88, -2.13, 1.38, -3.25, -2.13, -2.5, 12.1, 938],
  ["NCR Voyix", "Commerce / Banking Platforms", "Public", "BBG01J2K8DF0", GTD, "B1 / B+", 2000, 300, "13-Apr-29", 99.88, 100.25, "Normal", 0.0, -0.13, -0.19, 0.25, -0.13, -0.19, 0.06, 6.9, 322],
  ["Ensono", "Hybrid IT / Managed Mainframe", "Private", "BBG00V5C2QH7", GTD, "B3 / B-", 1010, 400, "26-May-28", 93.25, 94.5, "OK", 0.13, -0.5, -1.25, 0.94, -1.88, -1.25, -1.0, 10.6, 754],
  ["Atos US Carve-out", "Digital Workplace / Legacy Outsourcing", "Private", "BBG01M8RT2J6", SR, "Caa1 / CCC+", 880, 500, "30-Jun-29", 71.0, 73.5, "Concerning", -0.5, -2.75, -6.13, -4.88, -9.5, -6.13, -8.75, 19.4, 1820],
  ["Synechron Intermediate", "Financial Services Consulting", "Private", "BBG01T6WXNV1", GTD, "B2 / B", 645, 350, "11-Dec-30", 99.5, 100.0, "Normal", 0.0, -0.06, -0.13, 0.38, -0.25, -0.13, 0.19, 7.4, 368],
];

const TECH_HARDWARE: T[] = [
  ["CommScope", "Network Infrastructure / Connectivity", "Public", "BBG00QXR4ND1", GTD, "Caa1 / CCC+", 3150, 325, "07-Apr-26", 87.25, 88.5, "Concerning", -0.25, -1.13, -3.0, -2.25, -6.38, -3.0, -5.0, 15.8, 1390],
  ["Coherent", "Photonics / Laser Systems", "Public", "BBG013BHM5P9", GTD, "Ba2 / BB", 2390, 250, "02-Jul-29", 100.38, 100.69, "High", 0.0, 0.06, 0.25, 0.63, 0.5, 0.25, 0.56, 6.1, 239],
  ["Viavi Solutions", "Test & Measurement / Optical", "Public", "BBG01K9ZWPF3", SR, "Ba3 / BB-", 800, 275, "15-Mar-30", 100.0, 100.38, "Normal", 0.0, -0.06, 0.0, 0.31, 0.13, 0.0, 0.25, 6.5, 277],
  ["Imprivata", "Healthcare Identity Hardware/Software", "Private", "BBG00YQ2TGD7", GTD, "B2 / B", 1430, 350, "01-Dec-27", 99.75, 100.25, "Normal", 0.0, -0.13, -0.19, 0.31, -0.19, -0.19, 0.06, 7.7, 391],
  ["Poly Carve-out", "Enterprise Audio / Video Endpoints", "Private", "BBG00W7VJXK8", GTD, "B3 / B-", 950, 425, "27-Aug-29", 92.0, 93.5, "OK", 0.13, -0.63, -1.63, 1.13, -2.5, -1.63, -1.38, 11.2, 817],
  ["Pitney Bowes", "Mailing Systems / Shipping Tech", "Public", "BBG01D4ZS6M2", GTD, "B1 / B+", 745, 400, "17-Mar-28", 99.5, 100.13, "Normal", 0.0, -0.19, -0.31, 0.44, -0.38, -0.31, 0.0, 8.5, 466],
  ["Zebra Peripherals SPV", "Enterprise Asset Tracking", "Private", "BBG01V2QK8H5", SR, "Ba3 / BB-", 600, 250, "23-May-31", 100.25, 100.63, "High", 0.0, 0.0, 0.13, 0.38, 0.25, 0.13, 0.31, 6.0, 244],
  ["Diebold Nixdorf", "ATM / Banking Hardware", "Public", "BBG01F8XW3R7", GTD, "B3 / B-", 1250, 525, "11-Jun-30", 95.75, 96.75, "OK", 0.25, -0.38, -0.94, 1.5, -1.13, -0.94, -0.63, 11.0, 802],
  ["Lexmark International", "Imaging / Print Hardware", "Private", "BBG00S4JZVC6", GTD, "Caa2 / CCC", 480, 550, "29-Jan-27", 64.5, 67.0, "Impaired", -1.13, -3.5, -7.25, -6.0, -12.13, -7.25, -10.5, 27.3, 2674],
];

const SOFTWARE: T[] = [
  ["Cloud Software Group", "Enterprise SaaS / Citrix-TIBCO", "Private", "BBG01CV7K2N8", GTD, "B2 / B", 6470, 400, "30-Mar-29", 99.63, 100.0, "Normal", 0.0, -0.13, -0.25, 0.5, -0.31, -0.25, 0.13, 8.4, 451],
  ["UKG", "HCM / Workforce Management", "Private", "BBG00ZQ8WJT4", GTD, "B2 / B+", 5150, 300, "03-Feb-31", 100.31, 100.63, "High", 0.0, 0.06, 0.19, 0.56, 0.44, 0.19, 0.5, 6.8, 308],
  ["Epicor", "ERP / Mid-Market Manufacturing", "Private", "BBG00X1RHGV2", GTD, "B1 / B+", 2790, 325, "30-Jul-27", 100.19, 100.5, "High", 0.0, 0.0, 0.13, 0.38, 0.31, 0.13, 0.38, 7.0, 334],
  ["Genesys", "CX / Contact Center Cloud", "Private", "BBG00WD3PZQ9", GTD, "B2 / B", 3680, 350, "01-Dec-27", 99.88, 100.25, "Normal", 0.0, -0.06, -0.13, 0.31, -0.13, -0.13, 0.19, 7.8, 402],
  ["Quest Software", "Systems Management / Security", "Private", "BBG00V8N4KL3", GTD, "Caa2 / CCC", 2810, 425, "01-Feb-29", 58.25, 60.75, "Impaired", -0.88, -2.88, -6.5, -5.13, -11.25, -6.5, -9.88, 24.6, 2390],
  ["RealPage", "PropTech / Rental Software", "Private", "BBG00YH6TBW1", GTD, "B3 / B-", 2940, 350, "24-Apr-28", 96.13, 96.88, "OK", 0.13, -0.44, -1.0, 1.25, -1.5, -1.0, -0.75, 9.2, 614],
  ["Anaplan", "Connected Planning SaaS", "Private", "BBG01A3MV5X7", SR, "B2 / B", 1530, 375, "20-Jun-29", 99.75, 100.25, "Normal", 0.0, -0.13, -0.19, 0.38, -0.25, -0.19, 0.06, 8.1, 429],
  ["Avalara", "Tax Compliance Automation", "Private", "BBG01B9WRKJ0", GTD, "B3 / B-", 2120, 425, "19-Oct-28", 98.5, 99.13, "OK", 0.25, -0.25, -0.56, 0.94, -0.81, -0.56, -0.25, 9.6, 661],
  ["Rocket Software", "Infrastructure Modernization", "Private", "BBG00ZK5DQP6", GTD, "B2 / B", 2250, 425, "28-Nov-28", 100.13, 100.5, "High", 0.0, 0.06, 0.13, 0.5, 0.38, 0.13, 0.44, 8.9, 478],
  ["Instructure", "EdTech / LMS", "Private", "BBG01PQ2HFM4", SR, "B2 / B", 1185, 350, "01-Oct-31", 99.88, 100.38, "Normal", 0.0, -0.06, -0.13, 0.31, -0.19, -0.13, 0.13, 7.6, 387],
];

const MEDIA_PUBLISHING: T[] = [
  ["Getty Images", "Visual Content Licensing", "Public", "BBG00XW9K2T3", GTD, "B2 / B", 1380, 450, "19-Feb-26", 99.25, 99.88, "Normal", 0.0, -0.13, -0.31, 0.5, -0.38, -0.31, 0.0, 9.3, 503],
  ["McGraw Hill", "Education Publishing / Courseware", "Private", "BBG00Y3VRJN8", GTD, "B2 / B", 4150, 400, "28-Jul-28", 100.13, 100.5, "High", 0.0, 0.06, 0.19, 0.56, 0.38, 0.19, 0.5, 8.6, 455],
  ["Houghton Mifflin Harcourt", "K-12 Curriculum / EdMedia", "Private", "BBG00ZL8XCV5", GTD, "B3 / B-", 1480, 525, "07-Apr-29", 95.5, 96.5, "OK", 0.13, -0.5, -1.13, 1.31, -1.75, -1.13, -0.88, 11.6, 838],
  ["iHeartMedia", "Broadcast Radio / Podcast Networks", "Public", "BBG00QV2WPL9", GTD, "Caa1 / CCC+", 1864, 300, "01-May-26", 76.5, 78.25, "Concerning", -0.38, -1.88, -4.5, -3.25, -8.0, -4.5, -6.75, 18.7, 1693],
  ["Audacy", "Broadcast Radio / Digital Audio", "Public", "BBG00R8ZK4H6", GTD, "Caa3 / CC", 632, 250, "24-Nov-26", 42.25, 45.5, "Impaired", -2.13, -4.25, -8.88, -7.5, -14.63, -8.88, -12.25, 39.8, 3865],
  ["Clear Channel Outdoor", "Out-of-Home Advertising", "Public", "BBG00TGJ7RD2", SR, "B3 / B-", 1250, 350, "21-Aug-28", 97.88, 98.5, "OK", 0.0, -0.25, -0.63, 0.81, -0.94, -0.63, -0.38, 9.0, 590],
  ["Gannett", "Local News / Digital Marketing", "Public", "BBG01E5WQXB4", GTD, "B3 / B-", 870, 500, "15-Oct-29", 96.25, 97.25, "OK", 0.13, -0.31, -0.81, 1.0, -1.25, -0.81, -0.5, 10.8, 763],
  ["Cengage Learning", "Higher-Ed Courseware / Skills", "Private", "BBG00WK3VTM7", GTD, "B2 / B", 1860, 425, "24-Mar-31", 100.0, 100.44, "Normal", 0.0, -0.06, -0.13, 0.38, -0.19, -0.13, 0.19, 8.8, 467],
  ["Dotdash Meredith", "Digital Publishing / Intent Media", "Public", "BBG01G2NRSF8", GTD, "B1 / B+", 1230, 400, "01-Dec-28", 100.25, 100.63, "High", 0.0, 0.06, 0.25, 0.5, 0.44, 0.25, 0.5, 8.3, 428],
  ["Recorded Books / RBmedia", "Audiobook Publishing", "Private", "BBG01HV6ZKQ1", GTD, "B3 / B-", 1090, 400, "31-Aug-28", 98.75, 99.5, "Normal", 0.0, -0.13, -0.31, 0.44, -0.5, -0.31, -0.06, 9.1, 568],
];

export interface Sector {
  name: string;
  color: string; // sheet-tab accent
  rows: RVRow[];
}

export const SECTORS: Sector[] = [
  { name: "Entertainment", color: "#f87171", rows: ENTERTAINMENT.map(row) },
  { name: "Telecommunications", color: "#38bdf8", rows: TELECOM.map(row) },
  { name: "IT Services", color: "#4ade80", rows: IT_SERVICES.map(row) },
  { name: "Tech Hardware", color: "#a78bfa", rows: TECH_HARDWARE.map(row) },
  { name: "Software", color: "#fb923c", rows: SOFTWARE.map(row) },
  { name: "Media & Publishing", color: "#facc15", rows: MEDIA_PUBLISHING.map(row) },
];

// ─── US Leveraged Loan Index statistics (shared across sectors) ────────────
export interface IndexStat {
  name: string;
  mv: number; // $Bn
  avgPrice: number;
  d: (number | null)[];
  ytm: number;
  dm: number;
}

export const INDEX_STATS: IndexStat[] = [
  { name: "US Leveraged Loan Index: Ba", mv: 357, avgPrice: 99.42, d: [-0.03, -0.02, 0.07, 2.14, 3.35, 0.07, 2.95], ytm: 6.4, dm: 255 },
  { name: "US Leveraged Loan Index: Ba/B", mv: 1306, avgPrice: 97.38, d: [-0.11, -0.13, 0.12, 2.8, 2.63, 0.12, 2.17], ytm: 7.8, dm: 408 },
  { name: "US Leveraged Loan Index: B", mv: 949, avgPrice: 96.63, d: [-0.14, -0.18, 0.13, 3.05, 2.31, 0.13, 1.84], ytm: 8.4, dm: 465 },
  { name: "US Leveraged Loan Index: Caa", mv: 89, avgPrice: 77.75, d: [0.12, 0.37, 1.94, 2.91, -3.55, 1.94, -3.52], ytm: 18.9, dm: 1552 },
];

// ─── Per-rating-bucket averages, computed from the sector's rows ───────────
export interface RatingAvg {
  bucket: string;
  n: number;
  size: number | null;
  margin: number | null;
  bid: number | null;
  ask: number | null;
  d: (number | null)[];
  ytm: number | null;
  dm: number | null;
}

const BUCKETS = ["Ba1", "Ba2", "Ba3", "B1", "B2", "B3", "Caa1", "Caa2", "Caa3", "NR"];

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function ratingAverages(rows: RVRow[]): RatingAvg[] {
  return BUCKETS.map((bucket) => {
    const members = rows.filter((r) => (r.rating.split(" ")[0] || "NR") === bucket);
    return {
      bucket,
      n: members.length,
      size: mean(members.map((r) => r.size)),
      margin: mean(members.map((r) => r.margin)),
      bid: mean(members.map((r) => r.bid)),
      ask: mean(members.map((r) => r.ask)),
      d: [0, 1, 2, 3, 4, 5, 6].map((i) =>
        mean(members.map((r) => r.d[i]).filter((x): x is number => x !== null))
      ),
      ytm: mean(members.map((r) => r.ytm)),
      dm: mean(members.map((r) => r.dm)),
    };
  }).filter((b) => b.n > 0 || ["Caa2", "NR"].includes(b.bucket));
}

export const DELTA_COLS = ["Δ 1D", "Δ 1W", "Δ 1M", "Δ 3M", "Δ 6M", "Δ 1YR", "Δ YTD"];
