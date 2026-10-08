import { View } from "react-native";
import SeamPlayerDOM from "./SeamPlayerDOM";

export default function WatchScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <SeamPlayerDOM
        src="https://cdn.example.com/film.mp4"
        title="Film"
        dom={{
          scrollEnabled: false,
          style: { height: 240 },
          allowsInlineMediaPlayback: true,
        }}
      />
    </View>
  );
}
