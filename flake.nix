{
  description = "CNPG Admin - Kubernetes Operator UI for CloudNativePG";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        packages.cnpg-admin = pkgs.buildGoModule {
          pname = "cnpg-admin";
          version = "0.1.0";
          src = ./.;
          ldflags = [ "-s" "-w" ];
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [ go_1_26 golangci-lint goimports ];
        };
      });
}
