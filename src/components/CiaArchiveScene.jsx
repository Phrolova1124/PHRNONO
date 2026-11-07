import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// The shell is a stripped, attributed derivative of LBEILC's MIT archive asset.
// Original labels/branding are physically absent from the local GLB.
const MODEL = "/portfolio/cia-archive/archive-case.glb";
const ROWS = 34;
const LANES = 7;
const SPACING = 0.62;
const mod = (value, count) => ((value % count) + count) % count;
const ease = (value) => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
// A settled shoulder raises the selected column, as in the MIT reference.
// Only selection/extraction animates it; there is no permanent idle loop.
const shoulder = (row, lane, center) => Math.max(-0.42, 2.15 - 0.17 * (Math.sqrt((row - center) ** 2 + 1) - 1)) * (0.25 + 0.75 * Math.exp(-0.5 * (((lane - 3) / 0.55) ** 2)));

function disposeTree(tree) {
  const geometries = new Set();
  const materials = new Set();
  tree.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export default function CiaArchiveScene({
  selectedIndex = 0, detailOpen = false, reducedMotion = false, active = true,
  replayKey = 0, onSelect, onReady, onError,
}) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const values = useRef({ selectedIndex, detailOpen, reducedMotion, active, replayKey });
  const callbacks = useRef({ onSelect, onReady, onError });
  callbacks.current = { onSelect, onReady, onError };
  values.current = { selectedIndex, detailOpen, reducedMotion, active, replayKey };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let frame = 0;
    let ready = false;
    let renderer;
    let environment;
    let source;
    let startTime = 0;
    let width = 1;
    let height = 1;
    let visible = true;
    let lastIndex = selectedIndex;
    let lastReplay = replayKey;
    let inspectYaw = 0;
    let inspectPitch = 0;
    let matrixPose = "";
    let tweenFrom = { detail: detailOpen ? 1 : 0, row: selectedIndex, entrance: 0, selection: 0, yaw: 0, pitch: 0 };
    let current = { ...tweenFrom };
    let tweenTo = { ...current, entrance: 1 };
    const abort = new AbortController();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e7e1");
    scene.fog = new THREE.Fog("#e9e7e1", 110, 135);
    const camera = new THREE.PerspectiveCamera(7, 1, 0.1, 240);
    const array = new THREE.Group();
    const selected = new THREE.Group();
    const instances = [];
    const cells = [];
    const dummy = new THREE.Object3D();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const direction = new THREE.Vector3();
    const aim = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const detailDirection = new THREE.Vector3(-0.277, 0.238, 0.931).normalize();
    const browseDirection = new THREE.Vector3(-0.805, 0.326, 0.496).normalize();
    scene.add(array, selected);

    const fail = () => {
      if (disposed) return;
      ready = false;
      cancelAnimationFrame(frame);
      frame = 0;
      callbacks.current.onError?.();
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;";
      host.appendChild(renderer.domElement);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.48;
      room.dispose();
      pmrem.dispose();
      scene.add(new THREE.HemisphereLight("#fffaf5", "#b4a18c", 0.65));
      const key = new THREE.DirectionalLight("#fff7ed", 1.4);
      key.position.set(-6, 14, -5);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -22, right: 22, top: 20, bottom: -20, near: 0.1, far: 50 });
      key.shadow.normalBias = 0.035;
      key.shadow.bias = -0.0003;
      key.shadow.radius = 4;
      const fill = new THREE.DirectionalLight("#ffffff", 0.6);
      fill.position.set(7, 8, -10);
      scene.add(key, fill);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: "#ddd7ce", roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -4.63;
      floor.receiveShadow = true;
      scene.add(floor);
    } catch {
      fail();
      renderer?.dispose();
      renderer?.domElement.remove();
      disposeTree(scene);
      environment?.dispose();
      return undefined;
    }

    function pose() {
      const detail = current.detail;
      const portrait = width / height < 0.95;
      const entrance = current.entrance;
      const base = -4.6;
      const shift = current.row * SPACING;
      array.position.z = -shift;
      selected.position.set(0, base + 2.15 + 0.4 + detail * 3.9 - (1 - entrance) * 4 - current.selection * 0.28, -1.5);
      selected.rotation.set(current.pitch * detail, (-0.14 + current.yaw) * detail, 0);
      const selectedCell = 3 * ROWS + 16 + mod(values.current.selectedIndex, 6);
      const matrixKey = [detail, entrance, current.row, values.current.selectedIndex].join(":");
      if (matrixKey !== matrixPose) {
        matrixPose = matrixKey;
        for (let index = 0; index < cells.length; index += 1) {
          const cell = cells[index];
          const wave = shoulder(cell.row, cell.lane, 16 + current.row);
          dummy.position.set((cell.lane - 3) * 5.2, base + wave * (1 - detail) - (1 - entrance) * (3 + Math.abs(cell.lane - 3) * 0.25), (cell.row - 16) * SPACING - 1.5);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(index === selectedCell ? 0 : 1);
          dummy.updateMatrix();
          instances.forEach((mesh) => mesh.setMatrixAt(index, dummy.matrix));
        }
        instances.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); });
      }
      direction.copy(browseDirection).lerp(detailDirection, detail).normalize();
      right.crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
      up.crossVectors(direction, right).normalize();
      const aspect = width / height;
      const span = portrait ? THREE.MathUtils.lerp(10, 9.4, detail) : THREE.MathUtils.lerp(7.33, 6.2, detail) * Math.max(1, (16 / 9) / aspect);
      aim.set(-1.09, -0.045, 0.48);
      const focus = selected.position.clone().add(new THREE.Vector3(0, 1.85, 0));
      focus.addScaledVector(right, (0.5 - (portrait ? 0.5 : 0.28)) * span * aspect);
      focus.addScaledVector(up, ((portrait ? 0.62 : 0.5) - 0.5) * span);
      aim.lerp(focus, detail);
      const distance = THREE.MathUtils.lerp(140, 72, detail);
      camera.position.copy(aim).addScaledVector(direction, distance);
      camera.lookAt(aim);
      camera.aspect = aspect;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(span / (2 * distance)));
      camera.updateProjectionMatrix();
      scene.fog.near = distance + THREE.MathUtils.lerp(6, -1, detail);
      scene.fog.far = distance + THREE.MathUtils.lerp(30, 12, detail);
    }

    function render(time) {
      frame = 0;
      if (disposed || !ready || !values.current.active || document.hidden || !visible) return;
      if (!startTime) startTime = time;
      const t = values.current.reducedMotion ? 1 : Math.min(1, (time - startTime) / 1300);
      const amount = ease(t);
      for (const key of Object.keys(current)) current[key] = THREE.MathUtils.lerp(tweenFrom[key], tweenTo[key], amount);
      pose();
      try { renderer.render(scene, camera); } catch { fail(); return; }
      if (t < 1) frame = requestAnimationFrame(render);
    }

    function wake() {
      if (!frame && !disposed && ready && values.current.active && !document.hidden && visible) frame = requestAnimationFrame(render);
    }

    function update() {
      if (disposed) return;
      tweenFrom = { ...current };
      if (lastIndex !== values.current.selectedIndex) {
        tweenFrom.selection = values.current.reducedMotion ? 0 : 1;
        lastIndex = values.current.selectedIndex;
        inspectYaw = 0;
        inspectPitch = 0;
      }
      if (lastReplay !== values.current.replayKey) {
        tweenFrom.entrance = 0;
        lastReplay = values.current.replayKey;
        inspectYaw = 0;
        inspectPitch = 0;
      }
      tweenTo = { detail: values.current.detailOpen ? 1 : 0, row: mod(values.current.selectedIndex, 6), entrance: 1, selection: 0, yaw: inspectYaw, pitch: inspectPitch };
      startTime = 0;
      if (!values.current.active) { cancelAnimationFrame(frame); frame = 0; }
      else wake();
    }

    function resize() {
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      wake();
    }

    function visibility() {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else wake();
    }

    let pointerDown;
    function pointerStart(event) {
      pointerDown = { x: event.clientX, y: event.clientY, yaw: inspectYaw, pitch: inspectPitch };
      if (values.current.detailOpen) renderer.domElement.setPointerCapture(event.pointerId);
    }
    function pointerMove(event) {
      if (!pointerDown || !ready || !values.current.detailOpen) return;
      inspectYaw = THREE.MathUtils.clamp(pointerDown.yaw + (event.clientX - pointerDown.x) * 0.007, -0.85, 0.85);
      inspectPitch = THREE.MathUtils.clamp(pointerDown.pitch + (event.clientY - pointerDown.y) * 0.005, -0.3, 0.3);
      tweenFrom = { ...current };
      tweenTo.yaw = inspectYaw;
      tweenTo.pitch = inspectPitch;
      startTime = 0;
      wake();
    }
    function pointerEnd(event) {
      if (!pointerDown || !ready) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      pointerDown = undefined;
      if (values.current.detailOpen) return;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
        callbacks.current.onSelect?.(mod(values.current.selectedIndex + (dx < 0 ? 1 : -1), 6));
        return;
      }
      if (Math.abs(dx) + Math.abs(dy) > 12) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(instances, false)[0];
      if (hit?.instanceId !== undefined) callbacks.current.onSelect?.(mod(cells[hit.instanceId].row - 16, 6));
    }
    function pointerCancel() { pointerDown = undefined; }

    function lost(event) { event.preventDefault(); fail(); }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = window.IntersectionObserver ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; }
    }) : null;
    intersectionObserver?.observe(host);
    document.addEventListener("visibilitychange", visibility);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("pointerdown", pointerStart);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerEnd);
    renderer.domElement.addEventListener("pointercancel", pointerCancel);
    apiRef.current = { update };
    resize();

    (async () => {
      try {
        const response = await fetch(MODEL, { signal: abort.signal });
        if (!response.ok) throw new Error("Archive model unavailable");
        const buffer = await response.arrayBuffer();
        if (disposed) return;
        const gltf = await new GLTFLoader().parseAsync(buffer, "");
        source = gltf.scene;
        if (disposed) { disposeTree(source); return; }
        source.updateMatrixWorld(true);
        for (let lane = 0; lane < LANES; lane += 1) {
          for (let row = 0; row < ROWS; row += 1) cells.push({ lane, row });
        }
        source.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const name = mesh.material.name.replace(/\.\d+$/, "");
          const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
          const material = new THREE.MeshPhysicalMaterial({ color: "#ede7df", roughness: 0.42, metalness: 0.02, envMapIntensity: 0.55 });
          if (name === "Frosted_Polymer") Object.assign(material, { transmission: 0.9, thickness: 0.08, roughness: 0.17, ior: 1.46, attenuationDistance: 2 });
          if (name === "Ivory_Edges") Object.assign(material, { transmission: 0.35, thickness: 0.04, roughness: 0.31 });
          if (name === "Optical_Diffuser") { material.color.set("#dfd8ce"); material.roughness = 0.7; }
          if (name === "Titanium_Fasteners") { material.color.set("#9b9c96"); material.metalness = 0.72; material.roughness = 0.24; }
          if (name.includes("Optic")) { material.color.set(name.includes("Amber") ? "#b1bb70" : "#c4baac"); material.roughness = 0.38; }
          if (name === "Index_Inlay") material.color.set("#d6f438");
          if (name.includes("Engraving")) { material.color.set("#d9d1c6"); material.roughness = 0.6; }
          const part = new THREE.Mesh(geometry, material);
          part.receiveShadow = true;
          part.castShadow = name === "Optical_Diffuser";
          selected.add(part);
          if (!["Frosted_Polymer", "Ivory_Edges", "Optical_Diffuser", "Titanium_Fasteners", "Index_Inlay"].includes(name)) return;
          if (name === "Titanium_Fasteners" && host.clientWidth < 700) return;
          const arrayMaterial = material.clone();
          // Small viewports use opaque frosted shells. Desktop and the extracted
          // model retain the glass transmission pass.
          arrayMaterial.transmission = name === "Frosted_Polymer" && host.clientWidth >= 700 ? 0.78 : 0;
          if (name === "Titanium_Fasteners") { arrayMaterial.color.set("#bbb9b0"); arrayMaterial.roughness = 0.5; arrayMaterial.metalness = 0.35; }
          if (name === "Frosted_Polymer" || name === "Ivory_Edges") { arrayMaterial.color.set("#eee9df"); arrayMaterial.roughness = 0.34; }
          if (name === "Index_Inlay") arrayMaterial.color.set("#d9d4b6");
          // A baked height tint keeps the reference's soft molded depth without
          // a full-screen AO pass on every cassette and every mobile frame.
          if (name === "Frosted_Polymer") {
            arrayMaterial.onBeforeCompile = (shader) => {
              shader.vertexShader = "varying float archiveHeight;\n" + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\narchiveHeight = clamp(position.y / 3.7, 0.0, 1.0);");
              shader.fragmentShader = "varying float archiveHeight;\n" + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(0.52, 0.45, 0.36), vec3(1.0, 0.98, 0.94), smoothstep(0.1, 1.0, archiveHeight));");
            };
            arrayMaterial.customProgramCacheKey = () => "cia-molded-depth-v1";
          }
          const inst = new THREE.InstancedMesh(geometry, arrayMaterial, cells.length);
          inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          inst.receiveShadow = true;
          inst.castShadow = name === "Frosted_Polymer";
          array.add(inst);
          instances.push(inst);
        });
        disposeTree(source);
        source = null;
        ready = true;
        callbacks.current.onReady?.();
        update();
      } catch (error) {
        if (!disposed && error.name !== "AbortError") fail();
      }
    })();

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("pointerdown", pointerStart);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerEnd);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      if (apiRef.current?.update === update) apiRef.current = null;
      disposeTree(scene);
      scene.traverse((object) => object.shadow?.dispose());
      source && disposeTree(source);
      environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => { apiRef.current?.update(); }, [selectedIndex, detailOpen, reducedMotion, active, replayKey]);

  return <div className="cia-archive-scene" ref={hostRef} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }} />;
}
