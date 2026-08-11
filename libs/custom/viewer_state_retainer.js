document.addEventListener("DOMContentLoaded", () => {
    loadParams();
    const debouncedChangeUrl = debounce(changeUrl, 300);
    viewer.addEventListener("camera_changed", debouncedChangeUrl);
    viewer.scene.addEventListener("volume_added", (e) => {
        if(e.volume._isZoneVol) return;

        setAutoSwitchState(false);

        for(const zone of window.zones){
            if(zone._volumes){
                for(const vol of zone._volumes){
                    viewer.scene.removeVolume(vol);
                }
                zone._volumes = [];
            }
        }

        viewer.setClipTask(1);
    })
});

function loadParams () {
    const params = new URLSearchParams(window.location.search);

    if(!(params.has("position") || params.has("target"))) return;

    const posParam = params.get('position');
    const tarParam = params.get('target');

    const position = parseVec3(posParam);
    const target   = parseVec3(tarParam);

    if (!position || !target) return;

    moveCameraTo(position, target);

    // Zone / pointcloud visibility is applied later, once pointclouds and
    // zones have loaded — see applyZoneVisibilityFromURL(), called from
    // initZonesOps() / createZones(). Turning auto-switch off here already
    // stops it from fighting that restore while the scene loads.
    if(params.has("visibleZones") || params.has("visiblePCs") || params.has("volumes")) {
        setAutoSwitchState(false);
        if(params.has("volumes")) loadVolumesFromURL(params.get("volumes"));
        return;
    }

    setAutoSwitchState(true);

}

/**
 * One-time startup restore of zone visibility. Runs once zones AND
 * pointclouds are loaded (called at the end of initZonesOps/createZones):
 *   1. visibleZones URL param  → show exactly those zones.
 *   2. legacy visiblePCs param → apply pointcloud visibility, then infer.
 *   3. no zone info in the URL → infer which zones the default pointcloud
 *      visibility corresponds to, so the zone checkboxes reflect reality.
 */
function applyZoneVisibilityFromURL() {
    if (window._zoneURLStateApplied) return;
    window._zoneURLStateApplied = true;

    const params = new URLSearchParams(window.location.search);

    if (params.has("visibleZones")) {
        const names = params.get("visibleZones").split(",").map(decodeURIComponent);
        const wanted = (window.zones || []).filter(z => names.includes(z.name));

        if (wanted.length) {
            setAutoSwitchState(false);

            // Hide every pointcloud that belongs to no wanted zone, then
            // enable the wanted zones (skipping any a startup path such as
            // enableFirstZone already enabled, to not duplicate volumes).
            const wantedPCs = new Set();
            for (const z of wanted) for (const pc of (z.pointclouds || [])) wantedPCs.add(pc);
            for (const pc of viewer.scene.pointclouds) {
                if (!wantedPCs.has(pc)) pc.visible = false;
            }
            for (const z of wanted) {
                if (!window.newVisibleZones.has(z)) setZoneVisibility(z, true);
            }
            refreshZoneCheckboxStates();
            return;
        }
        // Named zones don't exist (renamed/removed) — fall through to inference.
    }

    // Legacy links stored pointcloud names: apply them so the inference
    // below reconstructs the matching zones.
    if (params.has("visiblePCs")) {
        const names = params.get("visiblePCs").split(",").map(decodeURIComponent);
        viewer.scene.pointclouds.forEach(pc => { pc.visible = names.includes(pc.name); });
        setAutoSwitchState(false);
    }

    // Mark every zone whose pointclouds are all visible as a visible zone.
    for (const zone of window.zones || []) {
        if (!zone.pointclouds || zone.pointclouds.length === 0) continue;
        if (zone.pointclouds.every(pc => pc && pc.visible)) {
            window.newVisibleZones.add(zone);

            // Pointcloud visibility is already correct — that's how we just
            // inferred this zone is "on" — but this path never runs
            // _enableZone()/setZoneVisibility(), so nothing has told the
            // zone's oriented-image sets or 360 markers to come on with it.
            // Left alone they stay on their constructor default of
            // _hidden = true, and the global oriented-image toggle can never
            // turn them on since it only re-applies each set's existing
            // tracked state.
            resetZoneOrientedImages(zone, true);
            setMarker360sVisibilityByZone(zone, true);
        }
    }
    refreshZoneCheckboxStates();
}

function changeUrl () {
    const cam = serializeCamera();
    const visibleZones = serializeZones();
    const volumes = serializeVolumesToCompressedString();

    const url = new URL(window.location);
    url.searchParams.set('position', cam.position);
    url.searchParams.set('target', cam.target);
    if(visibleZones) url.searchParams.set("visibleZones", visibleZones);
    else url.searchParams.delete("visibleZones");
    url.searchParams.delete("visiblePCs"); // legacy — superseded by visibleZones

    if(volumes && viewer.scene.volumes.length != 0) url.searchParams.set("volumes", volumes);
    else url.searchParams.delete("volumes");


    // console.log(url);

    history.pushState({}, '', url);

    return url;
}

function serializeVolumeToCompressedString(v) {
    if(window.zoneAutoSwitchState || viewer.scene.volumes.length == 0) return null;

    console.log(v);
    const volume = {
        uuid: v.uuid,
        type: 'BoxVolume',
        name: v.name || 'Volume',
        position: [v.position.x, v.position.y, v.position.z],
        rotation: [v.rotation.x, v.rotation.y, v.rotation.z, v.rotation.order],
        scale: [v.scale.x, v.scale.y, v.scale.z],
        visible: v.visible,
        clip: v.clip,
        clipTask: v.clipTask ?? null,         // store as int
        clipMethod: v.clipMethod ?? null      // store as int
    };

    const volumes = [volume];

    const globalClipTask = v.clipTask ?? null;
    const globalClipMethod = v.clipMethod ?? null;

    const payload = {
        volumes,
        globalClipTask,
        globalClipMethod
    };

    return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}


function serializeVolumesToCompressedString() {
    if(window.zoneAutoSwitchState || viewer.scene.volumes.length == 0) return null;

    const volumes = viewer.scene.volumes
        .filter(v => v instanceof Potree.BoxVolume)
        .map(v => ({
            uuid: v.uuid,
            type: 'BoxVolume',
            name: v.name || 'Volume',
            position: [v.position.x, v.position.y, v.position.z],
            rotation: [v.rotation.x, v.rotation.y, v.rotation.z, v.rotation.order],
            scale: [v.scale.x, v.scale.y, v.scale.z],
            visible: v.visible,
            clip: v.clip,
            clipTask: v.clipTask ?? null,         // store as int
            clipMethod: v.clipMethod ?? null      // store as int
        }));

    const globalClipTask = viewer.clipTask ?? null;
    const globalClipMethod = viewer.clipMethod ?? null;
    const payload = {
        volumes,
        globalClipTask,
        globalClipMethod
    };

    return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

function serializeZones () {

    if(window.zoneAutoSwitchState) return null; // if autoswitch on

    const visibleNames = [...(window.newVisibleZones || [])]
        .filter(z => z && z.name)
        .map(z => encodeURIComponent(z.name));

    if(visibleNames.length === 0) return null;

    return visibleNames.join(",");

}

function serializeCamera () {
    const camPos = viewer.scene.getActiveCamera().position;
    const camTar = viewer.scene.view.getPivot();
    
    const position = truncateDecimals(camPos.x, 3) + ";" + truncateDecimals(camPos.y, 3) + ";" + truncateDecimals(camPos.z, 3);
    const target = truncateDecimals(camTar.x, 3) + ";" + truncateDecimals(camTar.y, 3) + ";" + truncateDecimals(camTar.z, 3);

    return {position, target};
}


function loadVolumesFromURL(compressed) {
    try {
        const json = LZString.decompressFromEncodedURIComponent(compressed);
        const volumeData = JSON.parse(json);
        if (!volumeData) return;

        // Restore global clipTask and method (numeric enums)
        if (typeof volumeData.globalClipTask === 'number') {
            viewer.setClipTask(volumeData.globalClipTask);
        }

        if (typeof volumeData.globalClipMethod === 'number') {
            viewer.setClipMethod(volumeData.globalClipMethod);
        }

        // Restore volumes
        if (Array.isArray(volumeData.volumes)) {
            volumeData.volumes.forEach(v => {
                if (v.type === 'BoxVolume') {
                    const volume = new Potree.BoxVolume();

                    volume.uuid = v.uuid || THREE.MathUtils.generateUUID();
                    volume.name = v.name || "Volume";
                    volume.position.set(...v.position);
                    volume.rotation.set(v.rotation[0], v.rotation[1], v.rotation[2], v.rotation[3]);
                    volume.scale.set(...v.scale);
                    volume.visible = v.visible;
                    volume.clip = v.clip;

                    if (typeof v.clipTask === 'number') {
                        volume.clipTask = v.clipTask;
                    }

                    if (typeof v.clipMethod === 'number') {
                        volume.clipMethod = v.clipMethod;
                    }

                    viewer.scene.addVolume(volume);
                }
            });
        }

    } catch (err) {
        console.error("Failed to load volumes from URL:", err);
    }
}


function truncateDecimals(number, digits) {
    const multiplier = Math.pow(10, digits);
    return Math.trunc(number * multiplier) / multiplier;
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function parseVec3(param) {
    if (!param) return null;

    const parts = param.split(';');
    if (parts.length !== 3) return null;

    const nums = parts.map(v => Number(v));

    if (!nums.every(Number.isFinite)) return null;

    return new THREE.Vector3(nums[0], nums[1], nums[2]);
}


// from https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js

var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(o){return null==o?"":""==o?null:i._decompress(o.length,16384,function(r){return o.charCodeAt(r)-32})},compressToUint8Array:function(o){for(var r=i.compress(o),n=new Uint8Array(2*r.length),e=0,t=r.length;t>e;e++){var s=r.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null===o||void 0===o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;t>e;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(n){return o(e,r.charAt(n))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(o,r,n){if(null==o)return"";var e,t,i,s={},p={},u="",c="",a="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<o.length;i+=1)if(u=o.charAt(i),Object.prototype.hasOwnProperty.call(s,u)||(s[u]=f++,p[u]=!0),c=a+u,Object.prototype.hasOwnProperty.call(s,c))a=c;else{if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++),s[c]=f++,a=String(u)}if(""!==a){if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==r-1){d.push(n(m));break}v++}return d.join("")},decompress:function(o){return null==o?"":""==o?null:i._decompress(o.length,32768,function(r){return o.charCodeAt(r)})},_decompress:function(o,n,e){var t,i,s,p,u,c,a,l,f=[],h=4,d=4,m=3,v="",w=[],A={val:e(0),position:n,index:1};for(i=0;3>i;i+=1)f[i]=i;for(p=0,c=Math.pow(2,2),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(t=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 2:return""}for(f[3]=l,s=l,w.push(l);;){if(A.index>o)return"";for(p=0,c=Math.pow(2,m),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(l=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 2:return w.join("")}if(0==h&&(h=Math.pow(2,m),m++),f[l])v=f[l];else{if(l!==d)return null;v=s+s.charAt(0)}w.push(v),f[d++]=s+v.charAt(0),h--,s=v,0==h&&(h=Math.pow(2,m),m++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module&&(module.exports=LZString);