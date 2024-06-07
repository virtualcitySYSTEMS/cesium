vec3 lambertianDiffuse(vec3 diffuseColor)
{
    return diffuseColor / czm_pi;
}

vec3 fresnelSchlick2(vec3 f0, vec3 f90, float VdotH)
{
    float versine = 1.0 - VdotH;
    // pow(versine, 5.0) is slow. See https://stackoverflow.com/a/68793086/10082269
    float versineSquared = versine * versine;
    return f0 + (f90 - f0) * versineSquared * versineSquared * versine;
}

#ifdef USE_ANISOTROPY
/**
 * @param {float} roughness Material roughness (along the anisotropy bitangent)
 * @param {float} tangentialRoughness Anisotropic roughness (along the anisotropy tangent)
 * @param {vec3} lightDirection The direction from the fragment to the light source, transformed to tangent-bitangent-normal coordinates
 * @param {vec3} viewDirection The direction from the fragment to the camera, transformed to tangent-bitangent-normal coordinates
 */
float smithVisibilityGGX_anisotropic(float roughness, float tangentialRoughness, vec3 lightDirection, vec3 viewDirection)
{
    vec3 roughnessScale = vec3(tangentialRoughness, roughness, 1.0);
    float GGXV = lightDirection.z * length(roughnessScale * viewDirection);
    float GGXL = viewDirection.z * length(roughnessScale * lightDirection);
    float v = 0.5 / (GGXV + GGXL);
    return clamp(v, 0.0, 1.0);
}

/**
 * @param {float} roughness Material roughness (along the anisotropy bitangent)
 * @param {float} tangentialRoughness Anisotropic roughness (along the anisotropy tangent)
 * @param {vec3} halfwayDirection The unit vector halfway between light and view directions, transformed to tangent-bitangent-normal coordinates
 */
float GGX_anisotropic(float roughness, float tangentialRoughness, vec3 halfwayDirection)
{
    float roughnessSquared = roughness * tangentialRoughness;
    vec3 f = halfwayDirection * vec3(roughness, tangentialRoughness, roughnessSquared);
    float w2 = roughnessSquared / dot(f, f);
    return roughnessSquared * w2 * w2 / czm_pi;
}
#endif

float smithVisibilityG1(float NdotV, float roughness)
{
    // this is the k value for direct lighting.
    // for image based lighting it will be roughness^2 / 2
    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

/**
 * Estimate the geometric self-shadowing of the microfacets in a surface,
 * using the Schlick GGX approximation of a Smith visibility function.
 *
 * @param {float} roughness The roughness of the material.
 * @param {float} NdotL The cosine of the angle between the surface normal and the direction to the light source.
 * @param {float} NdotV The cosine of the angle between the surface normal and the direction to the camera.
 */
float smithVisibilityGGX(float roughness, float NdotL, float NdotV)
{
    // Avoid divide-by-zero errors
    NdotL = clamp(NdotL, 0.001, 1.0);
    NdotV += 0.001;
    return (
        smithVisibilityG1(NdotL, roughness) *
        smithVisibilityG1(NdotV, roughness)
    ) / (4.0 * NdotL * NdotV);
}

/**
 * Estimate the fraction of the microfacets in a surface that are aligned with
 * the halfway vector, which is aligned halfway between the directions from
 * the fragment to the camera and from the fragment to the light source.
 *
 * @param {float} roughness The roughness of the material.
 * @param {float} NdotH The cosine of the angle between the surface normal and the halfway vector.
 * @return {float} The fraction of microfacets aligned to the halfway vector.
 */
float GGX(float roughness, float NdotH)
{
    float roughnessSquared = roughness * roughness;
    float f = (NdotH * roughnessSquared - NdotH) * NdotH + 1.0;
    return roughnessSquared / (czm_pi * f * f);
}

/**
 * Compute the strength of the specular reflection due to direct lighting.
 *
 * @param {vec3} normal The surface normal.
 * @param {vec3} lightDirection The unit vector pointing from the fragment to the light source.
 * @param {vec3} viewDirection The unit vector pointing from the fragment to the camera.
 * @param {vec3} halfwayDirection The unit vector pointing from the fragment to halfway between the light source and the camera.
 * @param {float} roughness The roughness of the material.
 * @return {float} The strength of the specular reflection.
 */
float computeDirectSpecularStrength(vec3 normal, vec3 lightDirection, vec3 viewDirection, vec3 halfwayDirection, float roughness)
{
    float NdotL = dot(normal, lightDirection);
    float NdotV = abs(dot(normal, viewDirection));
    float G = smithVisibilityGGX(roughness, NdotL, NdotV);
    float NdotH = clamp(dot(normal, halfwayDirection), 0.0, 1.0);
    float D = GGX(roughness, NdotH);
    return G * D;
}

/**
 * Compute the diffuse and specular contributions using physically based
 * rendering. This function only handles direct lighting.
 * <p>
 * This function only handles the lighting calculations. Metallic/roughness
 * and specular/glossy must be handled separately. See {@MaterialStageFS}
 * </p>
 *
 * @name czm_pbrLighting
 * @glslFunction
 *
 * @param {vec3} viewDirectionEC Unit vector pointing from the fragment to the eye position
 * @param {vec3} normalEC The surface normal in eye coordinates
 * @param {vec3} lightDirectionEC Unit vector pointing to the light source in eye coordinates.
 * @param {czm_modelMaterial} The material properties.
 * @return {vec3} The computed HDR color
 */
vec3 czm_pbrLighting(vec3 viewDirectionEC, vec3 normalEC, vec3 lightDirectionEC, czm_modelMaterial material)
{
   #ifdef USE_VCS_CUSTOM_SHADING
        #ifdef USE_CUSTOM_LIGHT_COLOR
        vec3 lightColorHdr = model_lightColorHdr;
        #else
        vec3 lightColorHdr = czm_lightColorHdr;
        #endif
	    lightColorHdr *= 0.35;

	    vec3 diffuseColor = material.diffuse;
	    float u_lambertDiffuseMultiplier = 0.9;
		float u_vertexShadowDarkness = 0.3;

		float ambientLuminanceNight = 0.05;
		float ambientLuminanceDay = (1.0 - ambientLuminanceNight) * u_vertexShadowDarkness + ambientLuminanceNight;

	 	float distance = length(positionEC);
	    vec3 v = -normalize(positionEC);
	    vec3 l = normalize(lightDirectionEC);
	    vec3 h = normalize(v + l);
	    vec3 n = normalEC;
	    float NdotL = dot(n, l);
	    float NdotLclamped = clamp(NdotL, 0.0001, 1.0);
	    float NdotV = abs(dot(n, v)) + 0.001;
	    float NdotH = clamp(dot(n, h), 0.0, 1.0);
	    float VdotH = clamp(dot(v, h), 0.0, 1.0);

	    float directLight = clamp(NdotL*50.0, 0.0, 1.0);

	    vec3 positionWC = vec3(czm_inverseView * vec4(positionEC, 1.0));
	    vec3 upWC = normalize(positionWC);
	    vec3 lWC = normalize(czm_inverseViewRotation * l);
	    vec3 nWC = normalize(czm_inverseViewRotation * n);
	    float LdotZ = dot(lWC, -upWC);
	    float NdotZ = dot(nWC, upWC);
	    float sunAboveHorizon = clamp(-200.0 * LdotZ, 0.0, 1.0);

	    // beginning of nautical twilight at 12 degrees below horizon (in radiens)
	    float LdotZclamped = clamp(LdotZ, 0.0, 1.0);
	    float m = 0.209439510239;
	    float nn = (-LdotZclamped + m) / m;
	    float beta = smoothstep(0.0, 1.0, nn);
	    float ambientLightLuminance = mix(ambientLuminanceNight, ambientLuminanceDay, beta);

		//modify hue of sunlight
		vec3 directLightColorHdr = lightColorHdr;
	    float gamma = clamp(-20.0 * LdotZ, 0.0, 1.0);

	    float sun_minB =  0.5; //0.7;
	    float sun_minG = sun_minB * 0.5 + 0.5;
	    float sun_G = gamma*(1.0 - sun_minG) + sun_minG;
	    float sun_B = gamma*(1.0 - sun_minB) + sun_minB;
	    directLightColorHdr.g *= sun_G;
	    directLightColorHdr.b *= sun_B;

	    //ambient diffuse light
	    float ambientModulationMinimum = 0.2;
	    float ambientModulation = ambientModulationMinimum + (NdotZ*0.5 + 0.5)*(NdotL*0.2 + 0.8)*(1.0 - ambientModulationMinimum);
	    vec3 ambientLightContribution = diffuseColor * lightColorHdr * ambientLightLuminance * ambientModulation;

		// direct light
	    vec3 directLightContribution = diffuseColor * directLightColorHdr * NdotLclamped * u_lambertDiffuseMultiplier * sunAboveHorizon;

	    //direct specular light
	    vec3 f0 = material.specular;
	    float reflectance = max(max(f0.r, f0.g), f0.b);
	    vec3 f90 = vec3(clamp(reflectance * 25.0, 0.0, 1.0));
	    vec3 F = fresnelSchlick2(f0, f90, VdotH);
	    float alpha = material.roughness;
	    float G = smithVisibilityGGX(alpha, NdotLclamped, NdotV);
	    float D = GGX(alpha, NdotH);
	    vec3 directSpecularContribution = directLight * clamp(F * G * D / (4.0 * NdotLclamped * NdotV) * sunAboveHorizon * directLightColorHdr, 0.0, 1.0);

		//ambient specular light
		const vec3 blueSkyDiffuseColor = vec3(0.7, 0.85, 0.9);
		const vec3 REFLECTANCE_DIELECTRIC = vec3(0.04);
		vec3 g0 = (f0 - REFLECTANCE_DIELECTRIC) / (1.0 - REFLECTANCE_DIELECTRIC) ;
	    vec3 ambientSpecularContribution = g0 * blueSkyDiffuseColor * ambientLightLuminance * ambientModulation;

	    vec3 finalColorRGB = ambientLightContribution + directLightContribution + directSpecularContribution + ambientSpecularContribution;
	    return finalColorRGB;
	#else

    vec3 halfwayDirectionEC = normalize(viewDirectionEC + lightDirectionEC);
    float VdotH = clamp(dot(viewDirectionEC, halfwayDirectionEC), 0.0, 1.0);
    float NdotL = clamp(dot(normalEC, lightDirectionEC), 0.001, 1.0);

    vec3 f0 = material.specular;
    float reflectance = czm_maximumComponent(f0);
    // Typical dielectrics will have reflectance 0.04, so f90 will be 1.0.
    // In this case, at grazing angle, all incident energy is reflected.
    vec3 f90 = vec3(clamp(reflectance * 25.0, 0.0, 1.0));
    vec3 F = fresnelSchlick2(f0, f90, VdotH);

    #if defined(USE_SPECULAR)
        F *= material.specularWeight;
    #endif

    float alpha = material.roughness;
    #ifdef USE_ANISOTROPY
        mat3 tbn = mat3(material.anisotropicT, material.anisotropicB, normalEC);
        vec3 lightDirection = lightDirectionEC * tbn;
        vec3 viewDirection = viewDirectionEC * tbn;
        vec3 halfwayDirection = halfwayDirectionEC * tbn;
        float anisotropyStrength = material.anisotropyStrength;
        float tangentialRoughness = mix(alpha, 1.0, anisotropyStrength * anisotropyStrength);
        float G = smithVisibilityGGX_anisotropic(alpha, tangentialRoughness, lightDirection, viewDirection);
        float D = GGX_anisotropic(alpha, tangentialRoughness, halfwayDirection);
        vec3 specularContribution = F * G * D;
    #else
        float specularStrength = computeDirectSpecularStrength(normalEC, lightDirectionEC, viewDirectionEC, halfwayDirectionEC, alpha);
        vec3 specularContribution = F * specularStrength;
    #endif

    vec3 diffuseColor = material.diffuse;
    // F here represents the specular contribution
    vec3 diffuseContribution = (1.0 - F) * lambertianDiffuse(diffuseColor);

    // Lo = (diffuse + specular) * Li * NdotL
    return (diffuseContribution + specularContribution) * NdotL;
	#endif
}
