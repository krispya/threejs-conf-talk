export const codeExamples = [
  {
    id: 'imperative',
    label: 'Three: Imperative',
    language: 'javascript',
    code: `const geometry =
  new THREE.SphereGeometry()
const material =
  new MeltMaterial()
const sphere =
  new THREE.Mesh(geometry, material)

sphere.position.set(2, 0, 0)
scene.add(sphere)`,
  },
  {
    id: 'declarative',
    label: 'R3F: Declarative',
    language: 'jsx',
    code: `function App() {
  return (
    <Sphere position={[2, 0, 0]}>
      <MeltMaterial />
    </Sphere>
  )
}`,
  },
] as const;
