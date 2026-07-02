
// style.textContent += `
// .zone-block {
//   border-top: 1px solid #ddd;
//   padding-top: 8px;
//   margin-top: 8px;
// }asd
// .annotation-item {
//   cursor: pointer;
//   margin-left: 8px;
//   padding: 3px 4px;
//   border-radius: 4px;
// }
// .annotation-item:hover {
//   background: rgba(79,70,229,0.1);
// }
// .zone-list-container {
//   max-height: 80vh;
//   overflow-y: auto;
//   padding-right: 6px;
// }
// .zone-block {
//   border-left: 2px solid #e5e7eb;
//   padding-left: 10px;
//   margin-bottom: 10px;
//   transition: margin-left 0.2s;
// }
// .zone-search-input:focus {
//   outline: none;
//   border-color: #4f46e5;
//   box-shadow: 0 0 0 2px rgba(79,70,229,0.2);
// }
// #zoneSearchMenu {
//   display: flex;
//   flex-direction: column;
//   align-items: stretch;
//   justify-content: flex-start;
//   height: 100%;
//   width: 450px;
//   padding: 10px;
//   box-sizing: border-box;
// }

// .zone-list-container {
//   flex: 1;                /* fills remaining height */
//   overflow-y: auto;       /* scrollable list */
//   margin-top: 8px;
//   padding-right: 6px;
//   align-self: stretch;
// }

// .zone-search-input {
//   flex-shrink: 0;         /* keeps search bar fixed */
//   margin-bottom: 8px;
//   margin-top: 20px;
//   padding: 6px;
//   border: 1px solid #ccc;
//   border-radius: 6px;
//   width: 100%;
//   box-sizing: border-box;
// }

// `;

// style.textContent += `
// #zoneSearchMenu {
//   display: flex;
//   flex-direction: column;
//   align-items: stretch;
//   justify-content: flex-start;
//   height: auto;
//   max-height: 100%;
//   width: 400px;
//   padding: 10px 14px;
//   box-sizing: border-box;
// }

// /* Title (reduce top/bottom spacing) */
// #zoneSearchMenu h3 {
//   margin: 0;
//   margin-bottom: 6px;   /* ✅ Tight gap below title */
//   font-size: 18px;
//   font-weight: 600;
// }

// /* Search input right below the title */
// .zone-search-input {
//   flex-shrink: 0;
//   margin-bottom: 8px;
//   padding: 6px 10px;
//   border: 1px solid #ccc;
//   border-radius: 6px;
//   width: 100%;
//   box-sizing: border-box;
// }

// /* Scrollable list immediately below the search bar */
// .zone-list-container {
//   flex: 1;
//   overflow-y: auto;
//   padding-right: 6px;
//   margin: 0;
//   align-self: stretch;
// }

// .annotation-item {
//   cursor: pointer;
//   display: flex;
//   align-items: center;
//   gap: 6px;
//   padding: 4px 4px;
//   border-radius: 4px;
// }

// .annotation-item:hover {
//   background: #4f46e5;
// }

// .annotation-icon {
//   width: 18px;
//   height: 18px;
//   object-fit: contain;
//   opacity: 0.85;
// }

// .annotation-item:hover .annotation-icon {
//   opacity: 1;
// }

// .annotation-icon {
//     width: 18px;
//     height: 18px;
//     object-fit: contain;
//     opacity: 1 !important;
//     filter: none !important;
//     mix-blend-mode: normal !important;
// }

// .annotation-icon {
//     filter: drop-shadow(0 0 1px rgba(0,0,0,0.6));
// }

// .annotation-description,
// .annotation-description-content {
//     color: white !important;
//     text-align: center !important;
//     font-weight: bold !important;
// }

// .annotation-titlebar .annotation-label {
//     text-align: center !important;
//     width: 100%;
//     display: block;
//     color: white !important;
//     font-weight: bold !important;
// }

// `;

// style.textContent += `
// /* =============== TREE CONNECTORS =============== */

// /* Each zone block acts as a container for its own vertical line */
// .zone-block {
//     position: relative;
//     margin-bottom: 16px;
//     padding-left: 24px;    /* enough space for connector line */
// }

// /* Vertical line running down from the zone title */
// .zone-block::before {
//     content: "";
//     position: absolute;
//     left: 12px;            /* aligns with annotation arm */
//     top: 1.6em;            /* immediately below title */
//     bottom: 8px;           /* stops just above last annotation */
//     width: 2px;
//     background: #cfd1d4;   /* subtle connector color */
// }

// /* Zone name */
// .zone-block > h4 {
//     margin: 0 0 6px 0;
//     padding-left: 2px;
//     font-weight: 600;
// }

// /* Annotation list items */
// .annotation-item {
//     position: relative;
//     display: flex;
//     align-items: center;
//     gap: 6px;
//     padding: 6px 12px;
//     margin: 4px 0;
//     background: #18191cff;     /* your grey */
//     color: white;
//     border-radius: 6px;
// }

// /* Horizontal line connecting annotation to vertical line */
// .annotation-item::before {
//     content: "";
//     position: absolute;
//     left: -50px;              /* connects to the vertical line */
//     top: 50%;                 /* centers on annotation */
//     width: 50px;              /* length of horizontal arm */
//     height: 2px;
//     background: #cfd1d4;      /* same connector color */
//     transform: translateY(-50%);
// }

// /* ================= ICON FIX ================= */
// .annotation-icon {
//     width: 18px;
//     height: 18px;
//     object-fit: contain;
//     opacity: 1 !important;
//     filter: drop-shadow(0 0 1px rgba(0,0,0,0.6)) !important;
//     mix-blend-mode: normal !important;
// }

// /* --- Zone title row layout --- */
// .zone-title-row {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;  /* button left, checkbox right */
//     margin: 0 0 6px 0;
// }

// .zone-title-btn:hover {
//     background: #4f46e5;
// }

// /* --- Checkbox styling --- */
// .zone-checkbox {
//     width: 16px;
//     height: 16px;
//     cursor: pointer;
// }

// /* --- Title Row --- */
// .zone-title-row {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     margin: 2px 0 6px 0;
//     padding-right: 4px; /* slight inset to match annotations */
// }

// /* --- Title Button (larger + matching annotation style) --- */
// .zone-title-btn {
//     background: #818181ff;        /* same as annotation-item */
//     color: white;
//     font-weight: 600;
//     border: none;
//     padding: 8px 14px;          /* bigger button */
//     border-radius: 6px;
//     cursor: pointer;
//     font-size: 15px;
//     min-width: 150px;
//     text-align: left;
//     flex-grow: 1;               /* expands to align with long names */
//     margin-right: 8px;
//     transition: background 0.12s ease;
// }

// .zone-title-btn:hover {
//     background: #4f46e5;        /* purple hover */
// }

// /* --- Checkbox --- */
// .zone-checkbox {
//     width: 18px;
//     height: 18px;
//     cursor: pointer;
// }

// /* --- Improve alignment of connectors (adjust for taller button) --- */
// .zone-block::before {
//     top: 3.4em;   /* moves vertical line down for perfect alignment */
// }


// `;


// style.textContent = `
// .zone-panel {
//     position: fixed;
//     top: 80px;
//     right: -350px;
//     width: 350px;
//     height: 90%;
//     background: #ffffff;
//     border-left: 2px solid #4f46e5;
//     box-shadow: -4px 0 15px rgba(0,0,0,0.1);
//     padding: 20px;
//     z-index: 10000;
//     transition: right 0.3s ease;
//     font-family: sans-serif;
//     display: flex;
//     flex-direction: column;
//     justify-content: space-between;
// }
// .zone-panel.open {
//     right: 0;
// }
// .zone-panel h3 {
//     margin-top: 0;
//     color: #333;
//     text-align: center;
// }
// .zone-panel p {
//     flex: 1;
//     color: #555;
//     text-align: center;
//     margin-top: 40px;
// }
// .close-btn {
//     align-self: center;
//     margin-bottom: 10px;
//     background: #4f46e5;
//     color: white;
//     border: none;
//     border-radius: 6px;
//     padding: 8px 14px;
//     cursor: pointer;
//     transition: background 0.2s;
// }
// .close-btn:hover {
//     background: #3730a3;
// }
// `;
// style.textContent += `
// .zone-form {
//     display: flex;
//     flex-direction: column;
//     flex-grow: 1;
//     max-height: 110%;
//     margin-top: 15px;
//     padding: 15px 10px;
//     border-top: 1px solid #ddd;
//     animation: fadeIn 0.2s ease-in;
//     overflow-y: auto;
// }

// /* give scrollbar subtle styling */
// .zone-form::-webkit-scrollbar {
//     width: 6px;
// }
// .zone-form::-webkit-scrollbar-thumb {
//     background: #ccc;
//     border-radius: 3px;
// }

// .zone-form label {
//     font-weight: 600;
//     margin-top: 12px;
//     margin-bottom: 4px;
//     text-align: left;
// }
// .zone-form input,
// .zone-form select {
//     padding: 8px;
//     border: 1px solid #ccc;
//     border-radius: 5px;
//     margin-bottom: 12px;
// }
// .zone-form .hint {
//     font-size: 12px;
//     color: #666;
//     margin-bottom: 6px;
// }

// .sub-btn {
//     background: #4f46e5;
//     color: white;
//     border: none;
//     border-radius: 5px;
//     padding: 8px 10px;
//     margin-top: 10px;
//     cursor: pointer;
//     transition: background 0.2s;
// }
// .sub-btn:hover {
//     background: #3730a3;
// }
// .save-btn {
//     background: #16a34a;
// }
// .save-btn:hover {
//     background: #15803d;
// }

// @keyframes fadeIn {
//     from { opacity: 0; transform: translateY(5px); }
//     to { opacity: 1; transform: translateY(0); }
// }
// `;
// style.textContent += `
// #zonePointcloudSearch:focus {
//     outline: 2px solid #4f46e5;
//     border-color: #4f46e5;
// }
// #zonePointclouds {
//     min-height: 120px;
// }
// `;
// style.textContent += `
// .zone-form {
//     position: relative;
// }

// .zone-form-close {
//     position: absolute;
//     top: 6px;
//     right: 8px;
//     background: transparent;
//     border: none;
//     font-size: 20px;
//     line-height: 1;
//     color: #888;
//     cursor: pointer;
//     transition: color 0.2s;
// }
// .zone-form-close:hover {
//     color: #000;
// }
// `;
// style.textContent += `
// .bbox-container {
//     margin-top: 8px;
//     margin-bottom: 8px;
//     background: #f9fafb;
//     padding: 8px;
//     border-radius: 6px;
//     border: 1px solid #ddd;
// }
// .bbox-list {
//     list-style: none;
//     padding-left: 10px;
//     font-size: 13px;
//     color: #333;
//     max-height: 150px;
//     overflow-y: auto;
// }
// .bbox-list li {
//     margin-bottom: 4px;
// }
// `;
// style.textContent += `
// .bbox-list li {
//     margin-bottom: 4px;
//     font-family: monospace;
//     background: #f3f4f6;
//     padding: 4px 6px;
//     border-radius: 4px;
// }
// `;
// style.textContent += `
// .zone-list-container {
//     margin-top: 15px;
//     padding: 10px;
//     background: #f9fafb;
//     border-radius: 6px;
//     border: 1px solid #ddd;
//     height: 100%;
// }

// .zone-list-container h4 {
//     margin: 0 0 8px 0;
//     font-size: 15px;
//     color: #333;
//     text-align: left;
// }

// .zone-list {
//     list-style: none;
//     padding-left: 0;
//     margin: 0;
//     max-height: 100%;
//     overflow-y: auto;
// }

// .zone-item {
//     background: #fff;
//     border: 1px solid #ddd;
//     border-radius: 5px;
//     padding: 6px 8px;
//     margin-bottom: 6px;
//     cursor: pointer;
//     transition: background 0.2s;
// }

// .zone-item:hover {
//     background: #eef2ff;
// }

// .zone-empty {
//     color: #777;
//     font-style: italic;
// }
// `;
// style.textContent += `
// .zone-item {
//     display: flex;
//     justify-content: space-between;
//     align-items: center;
//     gap: 8px;
// }

// .zone-btn {
//     border: none;
//     border-radius: 5px;
//     padding: 4px 8px;
//     font-size: 12px;
//     cursor: pointer;
//     color: #fff;
//     transition: background 0.2s;
// }

// .edit-btn {
//     background: #2563eb;
// }
// .edit-btn:hover {
//     background: #1d4ed8;
// }

// .delete-btn {
//     background: #dc2626;
// }
// .delete-btn:hover {
//     background: #b91c1c;
// }
// `;
// style.textContent += `
// .close-btn {
//     margin-top: 6px;
//     background: #4f46e5;
//     color: white;
//     border: none;
//     border-radius: 6px;
//     padding: 8px 10px;
//     cursor: pointer;
//     transition: background 0.2s;
// }
// .close-btn:hover {
//     background: #3730a3;
// }
// `;
// style.textContent += `
// .sub-btn {
//     background: #4f46e5;
//     color: white;
//     border: none;
//     border-radius: 5px;
//     padding: 7px 10px;
//     margin-top: 8px;
//     cursor: pointer;
//     transition: background 0.2s;
// }
// .sub-btn:hover {
//     background: #3730a3;
// }
// `;
// style.textContent += `
// .zone-io-container {
//     display: flex;
//     justify-content: space-between;
//     gap: 8px;
//     margin-top: 6px;
// }

// .zone-io-container .close-btn {
//     flex: 1;
//     text-align: center;
//     background: #4f46e5;
//     color: white;
//     border: none;
//     border-radius: 6px;
//     padding: 8px 10px;
//     cursor: pointer;
//     transition: background 0.2s;
// }

// .zone-io-container .close-btn:hover {
//     background: #3730a3;
// }
// `;
// style.textContent += `
// #annotationDescription {
//     resize: vertical;
// }
// `;
// style.textContent += `
// #annotationForm {
//     margin-top: 10px;
//     border-top: 1px solid #ddd;
//     padding-top: 10px;
//     height: 150%;
// }
// `;
// style.textContent += `
// /* Style the annotation description panel */
// .annotation-description {
//   background: rgba(0, 0, 0, 0.65) !important;  /* translucent black */
//   color: #f1f1f1 !important;                   /* light text for contrast */
//   border-radius: 6px;
//   box-shadow: 0 2px 6px rgba(0,0,0,0.4);
//   max-width: 140px !important;                 /* smaller footprint */
//   max-height: 300px !important;
//   overflow-y: auto;
//   white-space: normal;
//   font-size: 14px;
//   padding: 6px 8px;
//   backdrop-filter: blur(6px);                  /* subtle frosted effect */
// }`;
// style.textContent += `
// .annotation-type-select {
//   width: 100%;
//   padding: 6px;
//   border: 1px solid #ccc;
//   border-radius: 6px;
//   font-size: 14px;
//   margin-bottom: 8px;
//   background: white;
// }
// `;
