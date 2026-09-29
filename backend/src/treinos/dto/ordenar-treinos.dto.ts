import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

/** Os ids das fichas de um aluno, na ordem nova. */
export class OrdenarTreinosDto {
  @IsString()
  alunoId: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true })
  ids: string[];
}
