import bearUrl from "../assets/avatars/棕熊.svg";
import catUrl from "../assets/avatars/猫咪.svg";
import cowUrl from "../assets/avatars/奶牛.svg";
import dogUrl from "../assets/avatars/小狗.svg";
import foxUrl from "../assets/avatars/狐狸.svg";
import frogUrl from "../assets/avatars/青蛙.svg";
import hamsterUrl from "../assets/avatars/仓鼠.svg";
import koalaUrl from "../assets/avatars/考拉.svg";
import lionUrl from "../assets/avatars/狮子.svg";
import monkeyUrl from "../assets/avatars/猴子.svg";
import pandaUrl from "../assets/avatars/熊猫.svg";
import penguinUrl from "../assets/avatars/企鹅.svg";
import pigUrl from "../assets/avatars/小猪.svg";
import rabbitUrl from "../assets/avatars/兔子.svg";
import raccoonUrl from "../assets/avatars/浣熊.svg";
import tigerUrl from "../assets/avatars/老虎.svg";

export interface AvatarOption {
  readonly id: string;
  readonly label: string;
  readonly src: string;
}

export const avatarOptions: readonly AvatarOption[] = [
  { id: "panda", label: "熊猫", src: pandaUrl },
  { id: "tiger", label: "老虎", src: tigerUrl },
  { id: "cat", label: "猫咪", src: catUrl },
  { id: "frog", label: "青蛙", src: frogUrl },
  { id: "monkey", label: "猴子", src: monkeyUrl },
  { id: "hamster", label: "仓鼠", src: hamsterUrl },
  { id: "pig", label: "小猪", src: pigUrl },
  { id: "rabbit", label: "兔子", src: rabbitUrl },
  { id: "bear", label: "棕熊", src: bearUrl },
  { id: "dog", label: "小狗", src: dogUrl },
  { id: "raccoon", label: "浣熊", src: raccoonUrl },
  { id: "lion", label: "狮子", src: lionUrl },
  { id: "fox", label: "狐狸", src: foxUrl },
  { id: "cow", label: "奶牛", src: cowUrl },
  { id: "penguin", label: "企鹅", src: penguinUrl },
  { id: "koala", label: "考拉", src: koalaUrl },
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
