import catUrl from "../assets/avatars/cat.svg";
import chickUrl from "../assets/avatars/chick.svg";
import cowUrl from "../assets/avatars/cow.svg";
import dogUrl from "../assets/avatars/dog.svg";
import foxUrl from "../assets/avatars/fox.svg";
import frogUrl from "../assets/avatars/frog.svg";
import hamsterUrl from "../assets/avatars/hamster.svg";
import lionUrl from "../assets/avatars/lion.svg";
import monkeyUrl from "../assets/avatars/monkey.svg";
import owlUrl from "../assets/avatars/owl.svg";
import pandaUrl from "../assets/avatars/panda.svg";
import penguinUrl from "../assets/avatars/penguin.svg";
import pigUrl from "../assets/avatars/pig.svg";
import rabbitUrl from "../assets/avatars/rabbit.svg";
import raccoonUrl from "../assets/avatars/raccoon.svg";
import tigerUrl from "../assets/avatars/tiger.svg";

export interface AvatarOption {
  readonly id: string;
  readonly label: string;
  readonly src: string;
}

export const avatarOptions: readonly AvatarOption[] = [
  { id: "panda", label: "熊猫", src: pandaUrl },
  { id: "fox", label: "狐狸", src: foxUrl },
  { id: "cat", label: "猫咪", src: catUrl },
  { id: "dog", label: "小狗", src: dogUrl },
  { id: "rabbit", label: "兔子", src: rabbitUrl },
  { id: "frog", label: "青蛙", src: frogUrl },
  { id: "penguin", label: "企鹅", src: penguinUrl },
  { id: "lion", label: "狮子", src: lionUrl },
  { id: "tiger", label: "老虎", src: tigerUrl },
  { id: "raccoon", label: "浣熊", src: raccoonUrl },
  { id: "hamster", label: "仓鼠", src: hamsterUrl },
  { id: "pig", label: "小猪", src: pigUrl },
  { id: "cow", label: "奶牛", src: cowUrl },
  { id: "monkey", label: "猴子", src: monkeyUrl },
  { id: "owl", label: "猫头鹰", src: owlUrl },
  { id: "chick", label: "小鸡", src: chickUrl },
];

export const defaultAvatarId = avatarOptions[0]?.id ?? "panda";

export function getAvatarOption(avatarId: string | undefined): AvatarOption {
  return (
    avatarOptions.find((avatarOption) => avatarOption.id === avatarId) ??
    avatarOptions[0] ?? {
      id: "fallback",
      label: "头像",
      src: pandaUrl,
    }
  );
}
