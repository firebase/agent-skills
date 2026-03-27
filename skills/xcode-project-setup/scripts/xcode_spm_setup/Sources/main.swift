import Foundation
import XcodeProj
import PathKit

func main() {
    let args = CommandLine.arguments
    guard args.count >= 5 else {
        print("Usage: swift run --package-path <path> xcode_spm_setup <Path/To/Project.xcodeproj> <RepoURL> <VersionRequirement> [--plist <Path/To/Plist>] <Product1> [Product2 ...]")
        exit(1)
    }

    var arguments = args
    _ = arguments.removeFirst() // executable name
    let projectPath = Path(arguments.removeFirst())
    let repoURL = arguments.removeFirst()
    let versionRequirementString = arguments.removeFirst()
    
    var plistPath: Path? = nil
    if let plistIndex = arguments.firstIndex(of: "--plist"), plistIndex + 1 < arguments.count {
        plistPath = Path(arguments[plistIndex + 1])
        arguments.remove(at: plistIndex + 1)
        arguments.remove(at: plistIndex)
    }
    
    let products = arguments

    guard !products.isEmpty else {
        print("Error: No products specified to link.")
        exit(1)
    }

    do {
        let xcodeproj = try XcodeProj(path: projectPath)
        let pbxproj = xcodeproj.pbxproj
        
        guard let rootObject = try pbxproj.rootProject() else {
            print("Error: Could not find root project")
            exit(1)
        }
        
        guard let target = pbxproj.nativeTargets.first else {
            print("Error: No native targets found")
            exit(1)
        }
        
        // 1. Add Plist to the project (Optional)
        if let plistPath = plistPath {
            print("Adding \(plistPath.lastComponent) to project...")
            let mainGroup = rootObject.mainGroup
            
            let appName = target.name
            let groupToAddTo = mainGroup?.children.first(where: { $0.path == appName }) as? PBXGroup ?? mainGroup
            
            // Only add if it doesn't already exist
            if groupToAddTo?.children.contains(where: { $0.path == plistPath.lastComponent || $0.name == plistPath.lastComponent }) == false {
                let fileRef = try groupToAddTo?.addFile(at: plistPath, sourceRoot: projectPath.parent())
                
                if let fileRef = fileRef, let buildPhase = target.buildPhases.first(where: { $0.buildPhase == .resources }) as? PBXResourcesBuildPhase {
                    _ = try buildPhase.add(file: fileRef)
                    print("Successfully added \(plistPath.lastComponent) to resources build phase.")
                }
            } else {
                print("\(plistPath.lastComponent) already exists in project.")
            }
        }
        
        // 2. Add Swift Package Dependency
        print("Adding Swift Package Dependency: \(repoURL)")
        
        // Check if package already exists
        let packageRef: XCRemoteSwiftPackageReference
        if let existingPkg = rootObject.remotePackages.first(where: { $0.repositoryURL == repoURL }) {
            packageRef = existingPkg
            print("Package already present.")
        } else {
            packageRef = try rootObject.addSwiftPackage(
                repositoryURL: repoURL, 
                productName: products.first!, 
                versionRequirement: .upToNextMajorVersion(versionRequirementString), 
                targetName: target.name
            )
        }
        
        // 3. Link requested products
        print("Linking products: \(products.joined(separator: ", "))")
        var frameworksBuildPhase = target.buildPhases.compactMap { $0 as? PBXFrameworksBuildPhase }.first
        if frameworksBuildPhase == nil {
            let newPhase = PBXFrameworksBuildPhase()
            pbxproj.add(object: newPhase)
            target.buildPhases.append(newPhase)
            frameworksBuildPhase = newPhase
        }
        
        for product in products {
            // Check if product is already linked
            if target.packageProductDependencies?.contains(where: { $0.productName == product }) == true {
                print("Product \(product) is already linked.")
                continue
            }
            
            let dependency = XCSwiftPackageProductDependency(productName: product, package: packageRef)
            pbxproj.add(object: dependency)
            
            if target.packageProductDependencies == nil { target.packageProductDependencies = [] }
            target.packageProductDependencies?.append(dependency)
            
            let buildFile = PBXBuildFile(product: dependency)
            pbxproj.add(object: buildFile)
            
            if frameworksBuildPhase?.files == nil { frameworksBuildPhase?.files = [] }
            frameworksBuildPhase?.files?.append(buildFile)
        }
        
        // Write changes
        try xcodeproj.write(path: projectPath)
        print("Successfully updated Xcode project!")
        
    } catch {
        print("Error: \(error)")
        exit(1)
    }
}

main()
