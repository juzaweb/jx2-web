import React from "react";

/**
 * Original ink-wash night backdrop shared by the lobby screens (login and
 * character select). Everything here is CSS + inline vector, so no external
 * wallpaper art is loaded; `preserveAspectRatio="none"` lets each range stretch
 * to the viewport width.
 */
export function LobbyScene() {
  return (
    <div className="jx2-scene" aria-hidden="true">
      <div className="jx2-scene-sky" />
      <div className="jx2-scene-stars" />
      <div className="jx2-scene-moon" />

      <svg className="jx2-scene-birds" viewBox="0 0 160 60" fill="none">
        <path d="M8 34 q7 -7 14 0 q7 -7 14 0" stroke="#dbe9ea" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M52 20 q5 -5 10 0 q5 -5 10 0" stroke="#dbe9ea" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M92 40 q4 -4 8 0 q4 -4 8 0" stroke="#dbe9ea" strokeWidth="1" strokeLinecap="round" />
      </svg>

      {/* Distant range */}
      <svg className="jx2-scene-range far" viewBox="0 0 1440 420" preserveAspectRatio="none">
        <path d="M0,330 L54,300 L86,312 L140,238 L186,290 L214,272 L262,196 L300,268 L340,240 L386,300 L430,216 L470,286 L506,262 L548,310 L596,178 L638,272 L676,240 L712,306 L760,210 L802,286 L844,258 L890,314 L938,230 L978,290 L1016,264 L1060,310 L1108,206 L1148,282 L1186,254 L1226,308 L1276,236 L1312,292 L1352,262 L1396,312 L1440,286 L1440,420 L0,420 Z" />
      </svg>

      <div className="jx2-scene-mist" />

      {/* Mid range with a distant pagoda */}
      <svg className="jx2-scene-range mid" viewBox="0 0 1440 420" preserveAspectRatio="none">
        <path d="M0,372 L58,344 L96,362 L150,296 L200,348 L246,320 L292,368 L344,268 L392,336 L436,304 L486,366 L534,246 L576,326 L620,296 L668,360 L712,268 L754,334 L796,306 L844,362 L892,248 L934,328 L974,300 L1022,362 L1064,262 L1106,334 L1150,300 L1198,362 L1240,274 L1282,336 L1326,306 L1374,364 L1418,300 L1440,330 L1440,420 L0,420 Z" />
        <g className="jx2-scene-pagoda">
          {/* Foundation runs down into the ridge so the tower never floats. */}
          <path d="M1124 262 H1250 V310 H1124 Z" />
          <path d="M1148 222 H1226 V262 H1148 Z" />
          <path d="M1112 228 Q1187 198 1262 228 L1244 236 H1130 Z" />
          <path d="M1160 190 H1214 V222 H1160 Z" />
          <path d="M1138 196 Q1187 170 1236 196 L1222 204 H1152 Z" />
          <path d="M1176 162 H1198 V190 H1176 Z" />
          <path d="M1156 168 Q1187 148 1218 168 L1206 175 H1168 Z" />
          <path d="M1183 132 H1191 V162 H1183 Z" />
          <circle cx="1187" cy="127" r="5" />
        </g>
      </svg>

      <div className="jx2-scene-mist lower" />
      {/* Near hills */}
      <svg className="jx2-scene-range near" viewBox="0 0 1440 260" preserveAspectRatio="none">
        <path d="M0,260 L0,236 L52,232 L98,244 L142,218 L190,240 L236,226 L282,246 L332,232 L378,250 L426,236 L472,252 L520,238 L566,254 L614,240 L662,256 L710,242 L756,258 L804,244 L850,260 L898,246 L944,260 L990,244 L1038,258 L1084,242 L1130,256 L1178,240 L1224,254 L1270,238 L1318,252 L1364,240 L1408,250 L1440,244 L1440,260 Z" />
      </svg>

      <div className="jx2-scene-pines">
        <svg viewBox="0 0 220 150" fill="#040a0e">
          <g transform="translate(40 142)">
            <rect x="-3" y="-14" width="6" height="16" />
            <polygon points="0,-84 20,-48 -20,-48" />
            <polygon points="0,-66 27,-24 -27,-24" />
            <polygon points="0,-44 34,2 -34,2" />
          </g>
          <g transform="translate(88 146) scale(0.72)">
            <rect x="-3" y="-14" width="6" height="16" />
            <polygon points="0,-84 20,-48 -20,-48" />
            <polygon points="0,-66 27,-24 -27,-24" />
            <polygon points="0,-44 34,2 -34,2" />
          </g>
          <g transform="translate(146 140) scale(0.92)">
            <rect x="-3" y="-14" width="6" height="16" />
            <polygon points="0,-84 20,-48 -20,-48" />
            <polygon points="0,-66 27,-24 -27,-24" />
            <polygon points="0,-44 34,2 -34,2" />
          </g>
          <g transform="translate(196 148) scale(0.58)">
            <rect x="-3" y="-14" width="6" height="16" />
            <polygon points="0,-84 20,-48 -20,-48" />
            <polygon points="0,-66 27,-24 -27,-24" />
            <polygon points="0,-44 34,2 -34,2" />
          </g>
        </svg>
      </div>
    </div>
  );
}
