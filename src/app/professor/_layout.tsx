import { Stack } from 'expo-router';

/** Área do professor: agenda (somente leitura) e treinos dos alunos. */
export default function ProfessorLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
