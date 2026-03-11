# Firebase AI Logic iOS Setup Guide

## 1. Import and Initialize
Ensure you have installed the `FirebaseAILogic` SDK via Swift Package Manager.

```swift
import FirebaseAILogic

// Initialize the Firebase AI service and the generative model.
let ai = FirebaseAI.firebaseAI()

// Specify a model that's appropriate for your use case.
let model = ai.generativeModel(modelName: "gemini-flash-latest")
```

## 2. Generate Text Content
```swift
let prompt = "Write a story about a magic backpack."

Task {
    do {
        let response = try await model.generateContent(prompt)
        if let text = response.text {
            print(text)
        }
    } catch {
        print("Error generating content: \(error)")
    }
}
```

## 3. Generate Content from Text and Image (Multimodal)
```swift
import UIKit

// Create an image from a bundled resource or URL
guard let image = UIImage(systemName: "star") else {
  fatalError("Unable to initialize image")
}
let prompt = "Describe what this image is."

Task {
    do {
        let response = try await model.generateContent(image, prompt)
        if let text = response.text {
            print(text)
        }
    } catch {
        print("Error generating content: \(error)")
    }
}
```

## 4. Chat Session (Multi-turn)
```swift
let chat = model.startChat()

Task {
    do {
        let response1 = try await chat.sendMessage("Hello! I have two dogs in my house.")
        print(response1.text ?? "")

        // The model remembers the history
        let response2 = try await chat.sendMessage("How many paws are in my house?")
        print(response2.text ?? "")
    } catch {
        print("Error in chat: \(error)")
    }
}
```
